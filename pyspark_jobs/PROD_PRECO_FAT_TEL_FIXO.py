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
    ToolID 26/28 (Dynamic Input / query dinamica)                    -> QUERY_ITENS_EXTRATO + extrai_itens_extrato()
    ToolID 2  (Summarize: GroupBy + Max ID_COBRANCA_PARCEIRO)        -> calcula_fatura_mais_recente() [DataFrame groupBy/F.max]
    ToolID 3  (Join Left/Right por CD_BASE, NUM_CONTRATO, CID_CONTRATO,
               ID_COBRANCA_PARCEIRO, COD_TERMINAL)                   -> filtra_itens_fatura_recente() [DataFrame join]
    ToolID 34 (Filter DSC_CODIGO != 'CREDITO')                       -> filtra_itens_fatura_recente() [DataFrame filter]
    ToolID 36 (Formula: COD_TERMINAL '-1' -> NULL)                   -> filtra_itens_fatura_recente() [DataFrame when/otherwise]
    ToolID 4  (Summarize: GroupBy + Sum(VLR) por terminal)           -> soma_valor_por_terminal() [DataFrame groupBy/F.sum]
    ToolID 35 (Summarize: Sum + CountNonNull por contrato)           -> soma_valor_por_contrato() [DataFrame groupBy/F.sum/F.count]
    ToolID 37 (Formula: VAL_VALOR / TOTAL_TERMINAL, evita /0)        -> soma_valor_por_contrato() [DataFrame withColumn]
    ToolID 30 (Summarize: GroupBy de dedup / rename Avg_VAL_VALOR)   -> renomeia_saida_final() [DataFrame withColumnRenamed]
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

Uso de SQL vs DataFrame:
    Apenas a extracao bruta (join das 5 tabelas de origem e filtros de
    status/vencimento) e feita via SQL, executada no banco via JDBC - isso
    equivale ao Dynamic Input original. Todos os agrupamentos (GroupBy) e
    funcoes de agregacao (Max, Sum, CountNonNull) do fluxo Alteryx sao
    implementados com a DataFrame API do PySpark (groupBy/agg com F.max,
    F.sum, F.count), assim como os joins, filtros e formulas subsequentes.
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

CHAVE_CONTRATO_TERMINAL = ["CD_BASE", "NUM_CONTRATO", "CID_CONTRATO", "COD_TERMINAL"]
CHAVE_CONTRATO = ["CD_BASE", "NUM_CONTRATO", "CID_CONTRATO"]

# ---------------------------------------------------------------------------
# Query de extracao bruta (ToolID 26/28: apenas o join/filtro do Dynamic
# Input, sem nenhuma agregacao - GroupBy/Max/Sum ficam a cargo do DataFrame)
# ---------------------------------------------------------------------------
QUERY_ITENS_EXTRATO = """
(
    SELECT /*+ PARALLEL(20) */
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
) QUERY_ITENS_EXTRATO
"""


def resolver_conexao_origem(ambiente: str) -> dict:
    """Equivalente ao Join (ToolID 24) que resolve CONEXAO a partir do AMBIENTE.

    No .yxmd, tanto "PROD" quanto "DEV" apontam para "ALTERYX_NETCDM" -
    mantido aqui apenas por fidelidade ao fluxo original.
    """
    conexoes_por_ambiente = {"PROD": JDBC_ORIGEM, "DEV": JDBC_ORIGEM}
    return conexoes_por_ambiente.get(ambiente, JDBC_ORIGEM)


def extrai_itens_extrato(spark: SparkSession) -> DataFrame:
    """ToolID 26/28: le os itens de extrato ja filtrados, sem agregacao."""
    conexao = resolver_conexao_origem(AMBIENTE)
    return (
        spark.read.format("jdbc")
        .option("url", conexao["url"])
        .option("driver", conexao["driver"])
        .option("user", conexao["user"])
        .option("password", conexao["password"])
        .option("query", QUERY_ITENS_EXTRATO)
        .load()
    )


def calcula_fatura_mais_recente(df_itens: DataFrame) -> DataFrame:
    """ToolID 2: GroupBy + Max(ID_COBRANCA_PARCEIRO) por contrato/terminal."""
    return df_itens.groupBy(*CHAVE_CONTRATO_TERMINAL).agg(
        F.max("ID_COBRANCA_PARCEIRO").alias("ID_COBRANCA_PARCEIRO")
    )


def filtra_itens_fatura_recente(
    df_itens: DataFrame, df_fatura_recente: DataFrame
) -> DataFrame:
    """ToolID 3 (join com a fatura mais recente) + ToolID 34 (filtro
    DSC_CODIGO != 'CREDITO') + ToolID 36 (COD_TERMINAL '-1' -> NULL)."""
    return (
        df_itens.join(
            df_fatura_recente,
            on=CHAVE_CONTRATO_TERMINAL + ["ID_COBRANCA_PARCEIRO"],
            how="inner",
        )
        .filter(F.col("DSC_CODIGO") != "CREDITO")
        .withColumn(
            "COD_TERMINAL",
            F.when(F.col("COD_TERMINAL") == "-1", None).otherwise(F.col("COD_TERMINAL")),
        )
        .select(*CHAVE_CONTRATO_TERMINAL, "VLR")
    )


def soma_valor_por_terminal(df_itens_fatura_recente: DataFrame) -> DataFrame:
    """ToolID 4: GroupBy + Sum(VLR) por CD_BASE/NUM_CONTRATO/CID_CONTRATO/COD_TERMINAL."""
    return df_itens_fatura_recente.groupBy(*CHAVE_CONTRATO_TERMINAL).agg(
        F.sum("VLR").alias("VAL_VALOR")
    )


def soma_valor_por_contrato(df_valor_por_terminal: DataFrame) -> DataFrame:
    """ToolID 35 (GroupBy + Sum + CountNonNull) e ToolID 37 (rateio pelo
    numero de terminais, evitando divisao por zero)."""
    df_agregado = df_valor_por_terminal.groupBy(*CHAVE_CONTRATO).agg(
        F.sum("VAL_VALOR").alias("VAL_VALOR_TOTAL"),
        F.count("COD_TERMINAL").alias("TOTAL_TERMINAL"),  # F.count ignora nulos (CountNonNull)
    )
    return df_agregado.withColumn(
        "VAL_VALOR",
        F.col("VAL_VALOR_TOTAL")
        / F.when(F.col("TOTAL_TERMINAL") == 0, F.lit(1)).otherwise(F.col("TOTAL_TERMINAL")),
    ).drop("VAL_VALOR_TOTAL", "TOTAL_TERMINAL")


def renomeia_saida_final(df_valor_por_contrato: DataFrame) -> DataFrame:
    """ToolID 30: renomeia para o layout de saida (COD_BASE, COD_CID_CONTRATO, Avg_VAL_VALOR)."""
    return (
        df_valor_por_contrato.withColumnRenamed("CD_BASE", "COD_BASE")
        .withColumnRenamed("CID_CONTRATO", "COD_CID_CONTRATO")
        .withColumnRenamed("VAL_VALOR", "Avg_VAL_VALOR")
        .select("COD_BASE", "NUM_CONTRATO", "COD_CID_CONTRATO", "Avg_VAL_VALOR")
    )


def calcula_valor_netfone(spark: SparkSession) -> DataFrame:
    """Encadeia os passos de GroupBy/Max/Sum equivalentes ao container "Valor NETFone".

    IMPORTANTE: df_itens e usado duas vezes a seguir - uma para calcular
    df_fatura_recente (groupBy) e outra diretamente no join. Sem cache, o
    Spark reexecutaria a query JDBC de extracao DUAS VEZES (uma por
    consumidor), podendo ler snapshots diferentes da tabela de origem caso
    ela receba cargas/commits concorrentes entre as duas leituras - o que
    quebra a premissa de que a fatura mais recente calculada corresponde
    exatamente aos itens usados no join. No Alteryx isso nao acontece
    porque o In-DB Tools compila a cadeia inteira em uma unica query,
    executada uma so vez.

    O .cache() abaixo e suficiente para evitar a releitura: dentro de uma
    unica acao (o write feito em main()), o Spark computa e armazena
    df_itens em cache na primeira vez que ele e necessario (no groupBy) e
    o join reaproveita o cache, sem nova consulta JDBC. Nao e necessario
    forcar a materializacao com um .count() - isso foi validado
    empiricamente (incl. sob concorrencia/particionamento maior) antes de
    remover essa linha daqui.
    """
    df_itens = extrai_itens_extrato(spark).cache()

    df_fatura_recente = calcula_fatura_mais_recente(df_itens)
    df_itens_fatura_recente = filtra_itens_fatura_recente(df_itens, df_fatura_recente)
    df_valor_por_terminal = soma_valor_por_terminal(df_itens_fatura_recente)
    df_valor_por_contrato = soma_valor_por_contrato(df_valor_por_terminal)
    # Nao chamar df_itens.unpersist() aqui: os passos acima sao lazy, entao o
    # cache so e efetivamente lido quando uma acao (write) rodar em main(),
    # depois que esta funcao retornar. Liberar o cache antes disso forcaria
    # o Spark a reler df_itens do JDBC, reintroduzindo o problema.
    return renomeia_saida_final(df_valor_por_contrato)


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

    df_valor_netfone = calcula_valor_netfone(spark).cache()

    grava_saida_origem(df_valor_netfone)
    executa_ddl_pos_carga(spark)
    grava_saida_nba(spark, df_valor_netfone)

    df_valor_netfone.unpersist()
    spark.stop()


if __name__ == "__main__":
    main()
