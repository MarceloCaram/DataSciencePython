"""
Conversao do fluxo Alteryx WF.NBAO.010601.PROD.PRECO.FAT.TEL.FIXO.EXTRACAO.yxmd para PySpark.

Regra de negocio (container "Valor NETFone" do .yxmd):
    Valor do NETFone extraido a partir dos itens de assinatura da fatura mais
    recente gerada nos ultimos 6 meses.

Entradas (Oracle, schema NETRDM):
    SN_ITEM_EXTRATO_PARCEIRO, SN_PARCEIRO, SN_TIPO_ITEM_EXTRATO_PARCEIRO,
    SN_GRUPO_TIPO_ITEM_EXTR_PARC, SN_CODIGO_ITEM_EXTRATO

Saidas:
    BI_FP_PROD_PRECO_FAT_TEL_FIXO           (schema de origem, overwrite)
    NBA_O.NBA_STG_PRODUTO_PRECO_TEL_FIXO    (schema NBA, delete + append by name)

Mapeamento das etapas do .yxmd para este script:
    ToolID 26/28 (Dynamic Input / query dinamica) -> QUERY_EXTRACAO (CTE itens_extrato)
    ToolID 2  (Summarize: GroupBy + Max ID_COBRANCA_PARCEIRO)  -> CTE fatura_mais_recente
    ToolID 3  (Join Left/Right por CD_BASE, NUM_CONTRATO, CID_CONTRATO,
               ID_COBRANCA_PARCEIRO, COD_TERMINAL)             -> CTE itens_fatura_recente
    ToolID 34 (Filter DSC_CODIGO != 'CREDITO')                 -> WHERE dentro da CTE acima
    ToolID 4  (Summarize: GroupBy + Sum(VLR) por terminal)     -> CTE valor_por_terminal
    ToolID 36 (Formula: COD_TERMINAL '-1' -> NULL)             -> CASE WHEN na CTE acima
    ToolID 35 (Summarize: Sum + CountNonNull por contrato)     -> CTE valor_por_contrato
    ToolID 37 (Formula: VAL_VALOR / TOTAL_TERMINAL, evita /0)  -> CTE acima (divisao com NULLIF)
    ToolID 30 (Summarize: GroupBy de dedup / rename Avg_VAL_VALOR) -> SELECT final da query
    ToolID 6  (Output BI_FP_PROD_PRECO_FAT_TEL_FIXO, Overwrite)      -> grava_saida_origem()
    ToolID 12 (DbFileOutput com PreSQL de GRANT/ALTER TABLE)         -> executa_ddl_pos_carga()
    ToolID 38/39/42/40 (rename + DAT_MOVIMENTO=TRUNC(SYSDATE) +
               Output NBA_O.NBA_STG_PRODUTO_PRECO_TEL_FIXO,
               CreateMode=Delete/AppendMode=ByName)                  -> grava_saida_nba()

Observacoes sobre elementos do .yxmd que NAO tem equivalente de dados (sao
infraestrutura do Alteryx) e portanto nao foram portados 1:1:
    - ToolID 19/22/23/24/25/31/32/33: resolvem dinamicamente a conexao
      (PROD/DEV) a partir do usuario logado no Alteryx. No .yxmd as duas
      entradas do lookup (PROD e DEV) apontam para a MESMA conexao
      "ALTERYX_NETCDM" - ou seja, na pratica o resultado independe do
      ambiente. Aqui isso vira apenas configuracao de conexao JDBC via
      variaveis de ambiente/parametro (AMBIENTE).
    - ToolID 10/11 (filtro fixo "1=2"): filtro sempre falso, nunca produz
      linhas; existia apenas como veiculo para disparar o PreSQL/PostSQL
      do DbFileOutput (grant/alter table + drop de tabela temporaria).
      Reproduzido em executa_ddl_pos_carga().
    - ToolID 39 (Stream In / TempTable na conexao ALTERYX_P01NBA): no
      Alteryx representa a transferencia dos dados para outra conexao de
      banco antes da carga final. Em Spark isso e natural: os dados ja
      estao em um DataFrame e sao gravados diretamente na conexao JDBC de
      destino (NBA_O), sem necessidade de tabela temporaria.

Uso de SQL:
    A extracao, os agrupamentos (GroupBy/Summarize) e os filtros do fluxo
    original foram implementados como uma unica query SQL (CTEs), executada
    no banco via JDBC. O resultado e carregado em um DataFrame Spark, que e
    usado apenas para as gravacoes finais (e o pequeno enriquecimento de
    DAT_MOVIMENTO, que no Alteryx e feito depois de os dados terem saido do
    banco de origem).
"""

import os

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F

# ---------------------------------------------------------------------------
# Configuracao de conexao (JDBC)
# ---------------------------------------------------------------------------
# No .yxmd, o ambiente (PROD/DEV) e resolvido comparando o usuario logado no
# Alteryx com "MDWALTERYXPRD". Aqui o ambiente e apenas um parametro externo,
# pois nao existe "usuario do Alteryx" em um job Spark.
AMBIENTE = os.environ.get("AMBIENTE", "DEV")

# Ambas as entradas do lookup do .yxmd (PROD e DEV) apontam para a mesma
# conexao "ALTERYX_NETCDM" -> aqui isso e refletido como uma unica config.
JDBC_ORIGEM = {
    "url": os.environ["NETCDM_JDBC_URL"],  # ex.: jdbc:oracle:thin:@//host:1521/service
    "driver": "oracle.jdbc.OracleDriver",
    "user": os.environ["NETCDM_JDBC_USER"],
    "password": os.environ["NETCDM_JDBC_PASSWORD"],
}

# Conexao de destino NBA (equivalente a "ALTERYX_P01NBA" no .yxmd).
JDBC_DESTINO_NBA = {
    "url": os.environ["P01NBA_JDBC_URL"],
    "driver": "oracle.jdbc.OracleDriver",
    "user": os.environ["P01NBA_JDBC_USER"],
    "password": os.environ["P01NBA_JDBC_PASSWORD"],
}

TABELA_SAIDA_ORIGEM = "BI_FP_PROD_PRECO_FAT_TEL_FIXO"
TABELA_SAIDA_NBA = "NBA_O.NBA_STG_PRODUTO_PRECO_TEL_FIXO"


# ---------------------------------------------------------------------------
# Query de extracao (concentra os componentes de filtro/group by do .yxmd)
# ---------------------------------------------------------------------------
QUERY_EXTRACAO = """
(
    WITH itens_extrato AS (
        SELECT /*+ PARALLEL(A, 20) PARALLEL(B, 20) PARALLEL(C, 20) PARALLEL(D, 20) PARALLEL(E, 20) */
               A.CD_BASE,
               A.NUM_CONTRATO,
               A.CID_CONTRATO,
               A.ID_COBRANCA_PARCEIRO,
               A.VLR,
               NVL(E.DESCRICAO, 'X') AS DSC_CODIGO,
               CASE
                   WHEN A.CC_TERMINAL_ORIGEM LIKE 'FRANQUIA%' THEN '-1'
                   ELSE SUBSTR(A.CC_TERMINAL_ORIGEM, 1, 10)
               END AS COD_TERMINAL
        FROM NETRDM.SN_ITEM_EXTRATO_PARCEIRO A
        INNER JOIN NETRDM.SN_PARCEIRO B
                ON B.FL_STATUS_BI = 'A'
               AND B.NM_PARCEIRO = 'EMBRATEL'
               AND B.CD_BASE = A.CD_BASE
               AND B.ID_PARCEIRO = A.ID_PARCEIRO
        INNER JOIN NETRDM.SN_TIPO_ITEM_EXTRATO_PARCEIRO C
                ON C.FL_STATUS_BI = 'A'
               AND C.CD_BASE = A.CD_BASE
               AND C.ID_TIPO_ITEM_EXTRATO_PARCEIRO = A.ID_TIPO_ITEM_EXTRATO_PARCEIRO
        INNER JOIN NETRDM.SN_GRUPO_TIPO_ITEM_EXTR_PARC D
                ON D.FL_STATUS_BI = 'A'
               AND D.CD_BASE = C.CD_BASE
               AND D.ID_GRUPO_TIPO_ITEM_EXTR_PARC = C.ID_GRUPO_TIPO_ITEM_EXTR_PARC
        LEFT JOIN NETRDM.SN_CODIGO_ITEM_EXTRATO E
               ON E.FL_STATUS_BI = 'A'
              AND E.CD_BASE = A.CD_BASE
              AND E.CODIGO = A.CODIGO
        WHERE A.FL_STATUS_BI = 'A'
          AND A.DT_VENCTO >= ADD_MONTHS(SYSDATE, -6)
    ),
    -- ToolID 2: fatura (ID_COBRANCA_PARCEIRO) mais recente por
    -- CD_BASE / NUM_CONTRATO / CID_CONTRATO / COD_TERMINAL
    fatura_mais_recente AS (
        SELECT CD_BASE,
               NUM_CONTRATO,
               CID_CONTRATO,
               COD_TERMINAL,
               MAX(ID_COBRANCA_PARCEIRO) AS ID_COBRANCA_PARCEIRO
        FROM itens_extrato
        GROUP BY CD_BASE, NUM_CONTRATO, CID_CONTRATO, COD_TERMINAL
    ),
    -- ToolID 3 (inner join com a fatura mais recente) + ToolID 34
    -- (filtro DSC_CODIGO != 'CREDITO') + ToolID 36 (COD_TERMINAL '-1' -> NULL)
    itens_fatura_recente AS (
        SELECT I.CD_BASE,
               I.NUM_CONTRATO,
               I.CID_CONTRATO,
               I.VLR,
               CASE WHEN I.COD_TERMINAL = '-1' THEN NULL ELSE I.COD_TERMINAL END AS COD_TERMINAL
        FROM itens_extrato I
        INNER JOIN fatura_mais_recente F
                ON F.CD_BASE = I.CD_BASE
               AND F.NUM_CONTRATO = I.NUM_CONTRATO
               AND F.CID_CONTRATO = I.CID_CONTRATO
               AND F.COD_TERMINAL = I.COD_TERMINAL
               AND F.ID_COBRANCA_PARCEIRO = I.ID_COBRANCA_PARCEIRO
        WHERE I.DSC_CODIGO != 'CREDITO'
    ),
    -- ToolID 4: soma do valor por terminal
    valor_por_terminal AS (
        SELECT CD_BASE,
               NUM_CONTRATO,
               CID_CONTRATO,
               COD_TERMINAL,
               SUM(VLR) AS VAL_VALOR
        FROM itens_fatura_recente
        GROUP BY CD_BASE, NUM_CONTRATO, CID_CONTRATO, COD_TERMINAL
    ),
    -- ToolID 35 + ToolID 37: soma total e rateio pelo numero de terminais do contrato
    valor_por_contrato AS (
        SELECT CD_BASE                                       AS COD_BASE,
               NUM_CONTRATO,
               CID_CONTRATO                                  AS COD_CID_CONTRATO,
               SUM(VAL_VALOR) / NULLIF(COUNT(COD_TERMINAL), 0) AS VAL_VALOR
        FROM valor_por_terminal
        GROUP BY CD_BASE, NUM_CONTRATO, CID_CONTRATO
    )
    -- ToolID 30: GroupBy final (dedup) / rename para Avg_VAL_VALOR
    SELECT COD_BASE,
           NUM_CONTRATO,
           COD_CID_CONTRATO,
           VAL_VALOR AS "Avg_VAL_VALOR"
    FROM valor_por_contrato
) QUERY_EXTRACAO
"""


def resolver_conexao_origem(ambiente: str) -> dict:
    """Equivalente ao Join (ToolID 24) que resolve CONEXAO a partir do AMBIENTE.

    No .yxmd, tanto "PROD" quanto "DEV" apontam para "ALTERYX_NETCDM" -
    mantido aqui apenas por fidelidade ao fluxo original.
    """
    conexoes_por_ambiente = {"PROD": JDBC_ORIGEM, "DEV": JDBC_ORIGEM}
    return conexoes_por_ambiente.get(ambiente, JDBC_ORIGEM)


def extrai_valor_netfone(spark: SparkSession) -> DataFrame:
    """Executa a query consolidada (extracao + group by + filtros) via JDBC."""
    conexao = resolver_conexao_origem(AMBIENTE)
    return (
        spark.read.format("jdbc")
        .option("url", conexao["url"])
        .option("driver", conexao["driver"])
        .option("user", conexao["user"])
        .option("password", conexao["password"])
        .option("query", QUERY_EXTRACAO)
        .load()
    )


def executa_ddl_pos_carga(spark: SparkSession) -> None:
    """Reproduz o PreSQL/PostSQL do DbFileOutput (ToolID 12).

    O .yxmd usava um filtro sempre-falso (1=2) apenas para acionar essas
    instrucoes de DDL no momento de gravar a tabela de saida. Como Spark
    nao executa DDL solto via DataFrameWriter, a conexao JDBC e usada
    diretamente para isso.
    """
    jvm = spark._sc._jvm
    conexao = resolver_conexao_origem(AMBIENTE)
    jdbc_conn = jvm.java.sql.DriverManager.getConnection(
        conexao["url"], conexao["user"], conexao["password"]
    )
    try:
        stmt = jdbc_conn.createStatement()
        try:
            stmt.execute(f"GRANT SELECT ON {TABELA_SAIDA_ORIGEM} TO PUBLIC")
            stmt.execute(
                f"ALTER TABLE {TABELA_SAIDA_ORIGEM} "
                "PARALLEL 32 NOLOGGING COMPRESS FOR QUERY HIGH"
            )
        finally:
            stmt.close()
    finally:
        jdbc_conn.close()


def grava_saida_origem(df: DataFrame) -> None:
    """ToolID 6: grava BI_FP_PROD_PRECO_FAT_TEL_FIXO em modo Overwrite."""
    conexao = resolver_conexao_origem(AMBIENTE)
    (
        df.write.format("jdbc")
        .option("url", conexao["url"])
        .option("driver", conexao["driver"])
        .option("user", conexao["user"])
        .option("password", conexao["password"])
        .option("dbtable", TABELA_SAIDA_ORIGEM)
        .mode("overwrite")
        .save()
    )


def grava_saida_nba(spark: SparkSession, df: DataFrame) -> None:
    """ToolID 38/42/40: renomeia, adiciona DAT_MOVIMENTO e grava na NBA.

    CreateMode=Delete + AppendMode=ByName no .yxmd equivale a:
    apagar todas as linhas da tabela destino e inserir os novos dados
    (sem recriar a tabela).
    """
    df_nba = df.withColumnRenamed("Avg_VAL_VALOR", "VAL_VALOR").withColumn(
        "DAT_MOVIMENTO", F.current_date()
    )

    jvm = spark._sc._jvm
    jdbc_conn = jvm.java.sql.DriverManager.getConnection(
        JDBC_DESTINO_NBA["url"],
        JDBC_DESTINO_NBA["user"],
        JDBC_DESTINO_NBA["password"],
    )
    try:
        stmt = jdbc_conn.createStatement()
        try:
            stmt.execute(f"DELETE FROM {TABELA_SAIDA_NBA}")
        finally:
            stmt.close()
    finally:
        jdbc_conn.close()

    (
        df_nba.write.format("jdbc")
        .option("url", JDBC_DESTINO_NBA["url"])
        .option("driver", JDBC_DESTINO_NBA["driver"])
        .option("user", JDBC_DESTINO_NBA["user"])
        .option("password", JDBC_DESTINO_NBA["password"])
        .option("dbtable", TABELA_SAIDA_NBA)
        .mode("append")
        .save()
    )


def main() -> None:
    spark = (
        SparkSession.builder.appName(
            "WF.NBAO.010601.PROD.PRECO.FAT.TEL.FIXO.EXTRACAO"
        ).getOrCreate()
    )

    df_valor_netfone = extrai_valor_netfone(spark).cache()

    grava_saida_origem(df_valor_netfone)
    executa_ddl_pos_carga(spark)
    grava_saida_nba(spark, df_valor_netfone)

    df_valor_netfone.unpersist()
    spark.stop()


if __name__ == "__main__":
    main()
