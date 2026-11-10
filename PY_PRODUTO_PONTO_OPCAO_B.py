import os
import sys
import time
import traceback
from pyspark import StorageLevel
from pyspark.sql import SparkSession, functions as F

spark = None

# =============================================================================
# Parametros de paralelismo
# -----------------------------------------------------------------------------
# NUM_PARTICOES_LEITURA: quantas consultas paralelas o Spark abre na ORIGEM.
#   Cada particao executa a query inteira (com o hint PARALLEL) sobre uma faixa
#   de ID_PONTO. Cuidado: particoes x PARALLEL = processos paralelos no Oracle.
# NUM_PARTICOES_ESCRITA: quantas conexoes simultaneas gravam no DESTINO.
# BATCH_SIZE: linhas por executeBatch; com isolationLevel=NONE cada batch e
#   comitado imediatamente (os dados aparecem na tabela durante a carga).
# =============================================================================
NUM_PARTICOES_LEITURA = 16
NUM_PARTICOES_ESCRITA = 16
BATCH_SIZE = 20000
FETCH_SIZE = 20000

# Join no Spark (OPCAO B): numero de particoes do shuffle do join TB01 x PERFIL.
# A TB01 e reparticionada por estas chaves com o MESMO numero de particoes,
# para o Spark poder reaproveitar essa distribuicao no join e embaralhar so o
# lado do perfil. Mantenha os dois valores iguais.
SHUFFLE_PARTITIONS = 64
CHAVES_JOIN_TB01 = ["CD_BASE", "NR_CONTRATO", "CD_CIDADE"]


def _get_param(nome, obrigatorio=True, default=None):
    """Busca um parametro na configuracao do Spark (spark.app.<nome>) ou em
    variavel de ambiente (<NOME>). Evita deixar senhas fixas no codigo.

    No OCI Data Flow, informe por exemplo em "Spark configuration properties":
        spark.app.db_password_source = ********
    ou, preferencialmente, leia o segredo do OCI Vault.
    """
    valor = spark.conf.get(f"spark.app.{nome}", None) or os.environ.get(nome.upper())
    if valor is None:
        valor = default
    if obrigatorio and valor is None:
        raise ValueError(
            f"Parametro '{nome}' nao informado "
            f"(spark.app.{nome} ou variavel de ambiente {nome.upper()})."
        )
    return valor


def _read_source(jdbc_url, user, password, query,
                 partition_column=None, lower_bound=None, upper_bound=None,
                 num_partitions=1):
    """Le uma subquery somente no banco de origem.

    Se partition_column for informado, o Spark divide a leitura em
    num_partitions consultas paralelas, cada uma com um intervalo da coluna.
    """
    reader = (
        spark.read.format("jdbc")
        .option("url", jdbc_url)
        .option("dbtable", f"({query})")
        .option("user", user)
        .option("password", password)
        .option("driver", "oracle.jdbc.OracleDriver")
        .option("fetchsize", str(FETCH_SIZE))
    )
    if partition_column:
        reader = (
            reader
            .option("partitionColumn", partition_column)
            .option("lowerBound", str(lower_bound))
            .option("upperBound", str(upper_bound))
            .option("numPartitions", str(num_partitions))
        )
    return reader.load()


def _write_target(dataframe, jdbc_url, user, password, table,
                  num_partitions=NUM_PARTICOES_ESCRITA):
    """Cria (ou trunca) e grava a tabela no destino.

    - numPartitions: limita/define as conexoes simultaneas de escrita.
    - isolationLevel=NONE: o Spark nao abre transacao por particao; cada batch
      e comitado (autocommit). Sem isso, nada fica visivel ate a particao
      inteira terminar. Em caso de falha pode sobrar carga parcial, que e
      limpa na proxima execucao (overwrite + truncate).
    """
    (
        dataframe.write.format("jdbc")
        .mode("overwrite")
        .option("url", jdbc_url)
        .option("dbtable", table)
        .option("user", user)
        .option("password", password)
        .option("driver", "oracle.jdbc.OracleDriver")
        .option("batchsize", str(BATCH_SIZE))
        .option("numPartitions", str(num_partitions))
        .option("isolationLevel", "NONE")
        .option("truncate", "true")
        .save()
    )


def _tempo(rotulo, inicio):
    decorrido = time.perf_counter() - inicio
    print(f"Tempo {rotulo}: {decorrido:.2f} segundos ({decorrido / 60:.2f} minutos)")


def main():
    global spark

    inicio_workflow = time.perf_counter()
    print("=== INICIO DO WORKFLOW ===")

    spark = SparkSession.builder.appName(
        "WF_NBAO_010101ABC_BI_FP_PRODUTOS_PONTO_REFATORADO"
    ).getOrCreate()
    spark.conf.set("spark.sql.adaptive.enabled", "true")
    spark.conf.set("spark.sql.shuffle.partitions", str(SHUFFLE_PARTITIONS))

    # ===============================
    # Conexao Oracle ORIGEM (NETCDM)
    # ===============================
    db_user_source = _get_param("db_user_source", default="z311102")
    db_password_source = _get_param("db_password_source")
    host_source = "scan-NETCDM.claro.com.br"
    port_source = "1521"
    service_name_source = "NETCDM"
    jdbc_url_source = (
        f"jdbc:oracle:thin:@//{host_source}:{port_source}/{service_name_source}"
    )

    # ===============================
    # Conexao Oracle ADEX (P39) - DESTINO
    # ===============================
    db_user_target = _get_param("db_user_target", default="z311102")
    db_password_target = _get_param("db_password_target")
    jdbc_url_target = (
        "jdbc:oracle:thin:@(description= (retry_count=20)(retry_delay=3)"
        "(address=(protocol=tcps)(port=1521)(host=scan-P39ADEX.claro.com.br))"
        "(connect_data=(service_name=g289f6309405a4f_P39ADEX_high.adb.oraclecloud.com))"
        "(security=(ssl_server_dn_match=no)))"
    )

    base = "ABC"

    # -------------------------------------------------------------------------
    # PASSO 01 - Limites de ID_PONTO para particionar a leitura
    # -------------------------------------------------------------------------
    print("=== PASSO 01a: CALCULANDO LIMITES DE PARTICIONAMENTO ===")
    inicio = time.perf_counter()
    bounds_query = f"""
        SELECT MIN(A.ID_PONTO) MN, MAX(A.ID_PONTO) MX
        FROM NETRDM.SN_REL_PONTO_PRODUTO A
        WHERE A.FL_STATUS_BI='A' AND A.INSTALADO=1
          AND A.DT_INI<TRUNC(SYSDATE) AND A.DT_FIM>=TRUNC(SYSDATE)
          AND A.CD_BASE='{base}'"""
    bounds = _read_source(
        jdbc_url_source, db_user_source, db_password_source, bounds_query
    ).first()
    if bounds is None or bounds["MN"] is None:
        print("Nenhum registro encontrado na origem. Encerrando.")
        return
    lower_bound = int(bounds["MN"])
    upper_bound = int(bounds["MX"]) + 1
    print(f"ID_PONTO entre {lower_bound} e {upper_bound}")
    _tempo("PASSO 01a", inicio)

    # -------------------------------------------------------------------------
    # PASSO 01 - Leitura dos produtos instalados (particionada)
    # Hint PARALLEL reduzido para 4: com 16 particoes, ate 64 processos no Oracle.
    # A.ID_PONTO e exposto como PART_KEY para o particionamento do Spark.
    # -------------------------------------------------------------------------
    print("=== PASSO 01b: LENDO PRODUTOS INSTALADOS DA ORIGEM ===")
    step_01_query = f"""
SELECT /*+ PARALLEL (4)
           INDEX (D IX_SN_PLANO_VENDA_02)
           INDEX (E IX_SN_PLANO_VENDA_PRODUTO_PREC) */
TRUNC(SYSDATE) DT_REF, A1.CD_BASE,
A1.NUM_CONTRATO NR_CONTRATO, A1.CID_CONTRATO CD_CIDADE,
A.ID_PONTO, A.ID_PRODUTO, C.DESCRICAO NM_PRODUTO,
B.ID_TIPO_PONTO, TP.DESCRICAO NM_CATEGORIA_PRODUTO,
CC.DESCRICAO NM_CARACTERISTICA, A.DT_INI DT_INI_PRODUTO,
A4.DESCONTO,
ROUND(DECODE(B.ID_PRECO,0,E.PRECO,H.PRECO)*((100-A4.DESCONTO)/100),2)
VL_PRODUTO,
E.PRECO VL_TABELA, C.DESCRICAO_BOLETO,
NVL(A1.ID_FORMA_ENVIO_FATURA,2) ID_FORMA_ENVIO_FATURA,
A1.ID_TIPO_COBRANCA, A1.ID_TIPO_CONTRATO, A1.ID_DIA_VCTO,
A2.ID_TIPO_ASSINANTE,
A.ID_PONTO PART_KEY
FROM NETRDM.SN_REL_PONTO_PRODUTO A
LEFT JOIN NETRDM.SN_REL_PONTO_PRODUTO_PRECO B
ON B.CD_BASE=A.CD_BASE AND B.ID_PONTO=A.ID_PONTO
AND B.ID_PROD_INSTALADO=A.ID_PRODUTO AND B.FL_STATUS_BI='A'
AND B.DT_INI<TRUNC(SYSDATE) AND B.DT_FIM>=TRUNC(SYSDATE)
JOIN NETRDM.SN_CONTRATO A1
ON A1.CD_BASE=A.CD_BASE AND A1.NUM_CONTRATO=A.NUM_CONTRATO
AND A1.CID_CONTRATO=A.CID_CONTRATO AND A1.FL_STATUS_BI='A'
JOIN NETRDM.SN_REL_CONTRATO_TIPO_ASSINANTE A2
ON A2.CD_BASE=A1.CD_BASE AND A2.NUM_CONTRATO=A1.NUM_CONTRATO
AND A2.CID_CONTRATO=A1.CID_CONTRATO
AND A2.DT_INI<TRUNC(SYSDATE) AND A2.DT_FIM>=TRUNC(SYSDATE)
AND A2.FL_STATUS_BI='A'
LEFT JOIN NETRDM.SN_REL_PRODUTO_CLASSE_PRECO A3
ON A3.CD_BASE=B.CD_BASE AND A3.ID_PRODUTO=B.ID_PROD_INSTALADO
AND A3.ID_TIPO_PONTO=B.ID_TIPO_PONTO
AND A3.DT_INI<TRUNC(SYSDATE) AND A3.DT_FIM>=TRUNC(SYSDATE)
AND A3.FL_STATUS_BI='A'
LEFT JOIN NETRDM.SN_REL_CLASSE_PRECO_TIPO_ASS A4
ON A4.CD_BASE=A2.CD_BASE AND A4.ID_TIPO_ASSINANTE=A2.ID_TIPO_ASSINANTE
AND A4.ID_CLASSE_PRECO=A3.ID_CLASSE_PRECO
AND A4.DT_INI<TRUNC(SYSDATE) AND A4.DT_FIM>=TRUNC(SYSDATE)
AND A4.FL_STATUS_BI='A'
JOIN NETRDM.SN_PRODUTO C
ON C.CD_BASE=A.CD_BASE AND C.ID_PRODUTO=A.ID_PRODUTO AND C.FL_STATUS_BI='A'
JOIN NETRDM.SN_TIPO_PRODUTO TP
ON C.ID_TIPO_PRODUTO=NVL(TP.ID_TIPO_PRODUTO,-1)
AND C.CD_BASE=TP.CD_BASE AND TP.FL_STATUS_BI='A'
LEFT JOIN NETRDM.SN_CARACTERISTICA CC
ON C.ID_CARACTERISTICA=CC.ID_CARACTERISTICA
AND C.CD_BASE=CC.CD_BASE AND CC.FL_STATUS_BI='A'
LEFT JOIN NETRDM.SN_PLANO_VENDA_PRODUTO D
ON D.CD_BASE=A1.CD_BASE AND D.ID_PLANO_VENDA=A1.ID_PLANO_VENDA
AND D.CD_BASE=B.CD_BASE AND D.ID_TIPO_PONTO=B.ID_TIPO_PONTO
AND D.ID_PRODUTO=B.ID_PROD_COBRADO
AND TRUNC(D.DT_INI_VENDA)<=TRUNC(A.DT_INI)
AND TRUNC(D.DT_FIM_VENDA)>TRUNC(A.DT_INI) AND D.FL_STATUS_BI='A'
LEFT JOIN NETRDM.SN_PLANO_VENDA_PRODUTO_PRECO E
ON E.CD_BASE=D.CD_BASE AND E.ID_PLANO_VENDA_PROD=D.ID_PLANO_VENDA_PROD
AND E.DT_INI_PRECO<TRUNC(SYSDATE) AND E.DT_FIM_PRECO>=TRUNC(SYSDATE)
AND E.FL_STATUS_BI='A'
LEFT JOIN NETRDM.SN_PRECO_ASSINANTE H
ON H.CD_BASE=B.CD_BASE AND H.ID_PRECO=B.ID_PRECO AND H.ID_PRECO!=0
AND H.DT_INI_PRECO<TRUNC(SYSDATE) AND H.DT_FIM_PRECO>=TRUNC(SYSDATE)
AND H.FL_STATUS_BI='A'
WHERE A.FL_STATUS_BI='A' AND A.INSTALADO=1
AND A.DT_INI<TRUNC(SYSDATE) AND A.DT_FIM>=TRUNC(SYSDATE)
AND A.CD_BASE='{base}'"""

    # Leitura e lazy: aqui so o plano e montado. A query roda de fato no write.
    tb01_df = _read_source(
        jdbc_url_source, db_user_source, db_password_source, step_01_query,
        partition_column="PART_KEY",
        lower_bound=lower_bound,
        upper_bound=upper_bound,
        num_partitions=NUM_PARTICOES_LEITURA,
    ).drop("PART_KEY")

    # repartition pelas chaves do join + persist em disco:
    # - a TB01 e usada duas vezes (gravacao no ADEX e join com o perfil), entao
    #   a query da origem roda uma vez so e a TB01 nao e relida do ADEX;
    # - a distribuicao por CD_BASE/NR_CONTRATO/CD_CIDADE em SHUFFLE_PARTITIONS
    #   particoes permite ao join reaproveitar o particionamento (confira com
    #   tb02_df.explain(): o lado "t" nao deve ter Exchange);
    # - o repartition tambem equilibra particoes desbalanceadas por ID_PONTO.
    # O persist e lazy: quem preenche o cache e a gravacao da TB01 logo abaixo.
    tb01_df = (
        tb01_df
        .repartition(SHUFFLE_PARTITIONS, *CHAVES_JOIN_TB01)
        .persist(StorageLevel.DISK_ONLY)
    )

    # -------------------------------------------------------------------------
    # PASSO 02 - Gravacao no destino (leitura da origem + cache + escrita)
    # numPartitions=NUM_PARTICOES_ESCRITA limita as conexoes no ADEX mesmo com
    # SHUFFLE_PARTITIONS particoes no DataFrame.
    # -------------------------------------------------------------------------
    tabela_destino = f"TMP_WRK_PROD_PONTO_{base}_TB01"
    print(f"=== PASSO 02: GRAVANDO {tabela_destino} NO DESTINO ===")
    inicio = time.perf_counter()
    _write_target(
        tb01_df, jdbc_url_target, db_user_target, db_password_target,
        tabela_destino, num_partitions=NUM_PARTICOES_ESCRITA,
    )
    print("=== FIM PASSO 02 ===")
    _tempo("PASSO 02 (leitura + gravacao)", inicio)

    # =========================================================================
    # OPCAO B - PERFIL COMBO com join no Spark
    # -------------------------------------------------------------------------
    # A TB01 vem do cache (tb01_df persistido), sem nova leitura no ADEX.
    # O perfil e lido do NETRDM particionado pela faixa de contratos da TB01.
    # Contratos fora da faixa nao se perdem: a primeira e a ultima particao do
    # Spark sao abertas nas pontas. Perfis fora da faixa apenas nao casam no
    # LEFT JOIN.
    # =========================================================================

    # -------------------------------------------------------------------------
    # PASSO 03a - Faixa de contratos (calculada a partir do cache)
    # -------------------------------------------------------------------------
    print("=== PASSO 03a: CALCULANDO FAIXA DE CONTRATOS ===")
    inicio = time.perf_counter()
    b = tb01_df.agg(
        F.min("NR_CONTRATO").alias("MN"), F.max("NR_CONTRATO").alias("MX")
    ).first()
    if b is None or b["MN"] is None:
        print(f"{tabela_destino} vazia. Encerrando.")
        tb01_df.unpersist()
        return
    c_low = int(b["MN"])
    c_up = int(b["MX"]) + 1
    print(f"NR_CONTRATO entre {c_low} e {c_up}")
    _tempo("PASSO 03a", inicio)

    # -------------------------------------------------------------------------
    # PASSO 03b - Leitura particionada do perfil combo
    # -------------------------------------------------------------------------
    print("=== PASSO 03b: LENDO PERFIL COMBO (NETRDM) ===")
    # Filtrado pela base: alem de reduzir o volume, evita casar contratos de
    # outras bases com o mesmo numero/cidade (o que duplicaria linhas).
    query_contr_perfil = f"""
SELECT CP.CD_BASE, CP.NUM_CONTRATO, CP.CID_CONTRATO,
       R.DESCRICAO PERFIL_COMBO
  FROM NETRDM.SN_REL_CONTRATO_PERFIL_CLT CP
  JOIN NETRDM.SN_REL_ATRIBUTOS_PARAMETRO R
    ON R.FL_STATUS_BI='A' AND CP.CD_BASE=R.CD_BASE
   AND R.ID_ATRIBUTO_PARAMETRO=CP.ID_PERFIL_CLIENTE
 WHERE CP.FN_INSTALADO=1
   AND CP.DT_FIM_OFERTA=TO_DATE('30/12/2049','DD/MM/YYYY')
   AND CP.FL_STATUS_BI='A'
   AND CP.CD_BASE='{base}'"""

    profiles_df = _read_source(
        jdbc_url_source, db_user_source, db_password_source,
        query_contr_perfil,
        partition_column="NUM_CONTRATO",
        lower_bound=c_low,
        upper_bound=c_up,
        num_partitions=NUM_PARTICOES_LEITURA,
    )

    # -------------------------------------------------------------------------
    # PASSO 03c - Join (CD_BASE + contrato + cidade) e gravacao da TB02
    # -------------------------------------------------------------------------
    tb02_df = (
        tb01_df.alias("t")
        .join(
            profiles_df.alias("p"),
            (F.col("t.CD_BASE") == F.col("p.CD_BASE"))
            & (F.col("t.NR_CONTRATO") == F.col("p.NUM_CONTRATO"))
            & (F.col("t.CD_CIDADE") == F.col("p.CID_CONTRATO")),
            "left",
        )
        .select("t.*", F.col("p.PERFIL_COMBO"))
        # repartition (e nao so o coalesce implicito do numPartitions do write):
        # o join roda com SHUFFLE_PARTITIONS tasks e so a gravacao usa
        # NUM_PARTICOES_ESCRITA conexoes.
        .repartition(NUM_PARTICOES_ESCRITA)
    )

    tabela_tb02 = f"TMP_WRK_PROD_PONTO_{base}_TB02"
    print(f"=== PASSO 03c: GRAVANDO {tabela_tb02} NO DESTINO ===")
    inicio = time.perf_counter()
    _write_target(
        tb02_df, jdbc_url_target, db_user_target, db_password_target,
        tabela_tb02, num_partitions=NUM_PARTICOES_ESCRITA,
    )
    print("=== FIM PASSO 03 ===")
    _tempo("PASSO 03 (leitura perfil + join + gravacao TB02)", inicio)

    tb01_df.unpersist()

    print("=== FIM DO WORKFLOW ===")
    _tempo("total do workflow", inicio_workflow)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        sys.exit(1)
