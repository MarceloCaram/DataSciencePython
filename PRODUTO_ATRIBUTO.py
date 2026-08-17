"""
Conversao do fluxo Alteryx WF.NBAO.022501.PRODUTO.ATRIBUTO (+ macros
Macro.Apaga.Tabela.Destino, Macro01.NBA.Atributo.Produto e
Macro02.NBA.Atributo.Produto) para PySpark.

Etapas:
  1. Limpa a tabela de destino na base stage (equivalente a
     Macro.Apaga.Tabela.Destino).
  2. Extrai e junta os atributos de produto na base legado (NETCDM) e grava
     na tabela temporaria de stage NBA_TMP_022501_1 (equivalente a
     Macro01.NBA.Atributo.Produto).
  3. Faz o pivot dos atributos (LISTAGG + PIVOT) e grava na tabela final
     NBA_O.NBA_STG_PRODUTO_ATRIBUTO (equivalente a
     Macro02.NBA.Atributo.Produto).

Conexao com os bancos via JDBC (Oracle). Toda a logica de negocio foi
mantida em SQL; o Python apenas orquestra execucao e carrega os resultados
em DataFrames.
"""

import logging
import os
from dataclasses import dataclass

from pyspark.sql import DataFrame, SparkSession

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("PRODUTO_ATRIBUTO")


@dataclass
class JdbcConn:
    url: str
    user: str
    password: str
    driver: str = "oracle.jdbc.OracleDriver"


# Conexoes equivalentes as conexoes Alteryx ALTERYX_P01NBA (stage) e
# ALTERYX_NETCDM (legado), parametrizadas via variaveis de ambiente.
STAGE_CONN = JdbcConn(
    url=os.environ["STAGE_JDBC_URL"],
    user=os.environ["STAGE_JDBC_USER"],
    password=os.environ["STAGE_JDBC_PASSWORD"],
    driver=os.environ.get("STAGE_JDBC_DRIVER", "oracle.jdbc.OracleDriver"),
)

LEGADO_CONN = JdbcConn(
    url=os.environ["LEGADO_JDBC_URL"],
    user=os.environ["LEGADO_JDBC_USER"],
    password=os.environ["LEGADO_JDBC_PASSWORD"],
    driver=os.environ.get("LEGADO_JDBC_DRIVER", "oracle.jdbc.OracleDriver"),
)

# Owners/schemas equivalentes aos parametros "OWNER STAGE" / "OWNER LEGADO"
# do TextInput do workflow principal.
STAGE_SCHEMA = os.environ.get("STAGE_SCHEMA", "NBA_O")
LEGADO_SCHEMA = os.environ.get("LEGADO_SCHEMA", "NETRDM")

TARGET_TABLE = f"{STAGE_SCHEMA}.NBA_STG_PRODUTO_ATRIBUTO"
TMP_TABLE = f"{STAGE_SCHEMA}.NBA_TMP_022501_1"
ATRIBUTO_LISTA_TABLE = f"{STAGE_SCHEMA}.NBA_STG_ATRIBUTO_LISTA"

# Equivalente ao "COMANDO" do TextInput (linha NUM_MACRO=01), valor PROD.
TRUNCATE_TARGET_SQL = f"CALL {STAGE_SCHEMA}.NBA_TRUNC_TABLE('NBA_STG_PRODUTO_ATRIBUTO')"

# As 4 fontes do Macro01 (Nodes 1/2, 3/5, 8/9, 14/15) sao mantidas como
# queries independentes e simples, para que cada uma faca pushdown completo
# no Oracle (a query unica com todos os JOINs nao volta - nao performatica).
# Os JOINs em si sao feitos no Spark, na funcao extrai_atributos_produto.
# Os aliases ja saem no nome final para os joins no Spark nao ficarem
# ambiguos.
PRODUTOS_SQL = """
SELECT CD_BASE AS COD_BASE, ID_PRODUTO AS COD_PRODUTO, NM_PRODUTO AS NOM_PRODUTO
FROM MDWALTERYXPRD.BI_FP_PRODUTOS_PONTO_ABC
UNION ALL
SELECT CD_BASE AS COD_BASE, ID_PRODUTO AS COD_PRODUTO, NM_PRODUTO AS NOM_PRODUTO
FROM MDWALTERYXPRD.BI_FP_PRODUTOS_PONTO_BHZ
UNION ALL
SELECT CD_BASE AS COD_BASE, ID_PRODUTO AS COD_PRODUTO, NM_PRODUTO AS NOM_PRODUTO
FROM MDWALTERYXPRD.BI_FP_PRODUTOS_PONTO_BRA
UNION ALL
SELECT CD_BASE AS COD_BASE, ID_PRODUTO AS COD_PRODUTO, NM_PRODUTO AS NOM_PRODUTO
FROM MDWALTERYXPRD.BI_FP_PRODUTOS_PONTO_ISP
UNION ALL
SELECT CD_BASE AS COD_BASE, ID_PRODUTO AS COD_PRODUTO, NM_PRODUTO AS NOM_PRODUTO
FROM MDWALTERYXPRD.BI_FP_PRODUTOS_PONTO_SOC
UNION ALL
SELECT CD_BASE AS COD_BASE, ID_PRODUTO AS COD_PRODUTO, NM_PRODUTO AS NOM_PRODUTO
FROM MDWALTERYXPRD.BI_FP_PRODUTOS_PONTO_SPO
UNION ALL
SELECT CD_BASE AS COD_BASE, ID_PRODUTO AS COD_PRODUTO, NM_PRODUTO AS NOM_PRODUTO
FROM MDWALTERYXPRD.BI_FP_PRODUTOS_PONTO_SUL
UNION ALL
SELECT CD_BASE AS COD_BASE, ID_PRODUTO AS COD_PRODUTO, DSC_PRODUTO AS NOM_PRODUTO
FROM MDWALTERYXPRD.BI_DIM_PRODUTO_PRECO_TABELA
"""

REL_PRODUTO_SQL = f"""
SELECT CD_BASE AS COD_BASE, ID_PRODUTO AS COD_PRODUTO, ID_ATRIBUTO_PARAMETRO
FROM {LEGADO_SCHEMA}.SN_REL_ATRIBUTOS_PRODUTO
WHERE FL_STATUS_BI = 'A'
  AND CD_BASE != 'CTV'
"""

REL_PARAMETRO_SQL = f"""
SELECT CD_BASE AS COD_BASE, ID_ATRIBUTO_PARAMETRO, ID_ATRIBUTO, DESCRICAO AS VAL_ATRIBUTO
FROM {LEGADO_SCHEMA}.SN_REL_ATRIBUTOS_PARAMETRO
WHERE FL_STATUS_BI = 'A'
  AND CD_BASE != 'CTV'
"""

ATRIBUTOS_SQL = f"""
SELECT CD_BASE AS COD_BASE, ID_ATRIBUTO, DESCRICAO AS NOM_ATRIBUTO
FROM {LEGADO_SCHEMA}.SN_ATRIBUTOS
WHERE FL_STATUS_BI = 'A'
  AND CD_BASE != 'CTV'
"""

EXTRACAO_ATRIBUTOS_COLS = ["COD_BASE", "COD_PRODUTO", "NOM_PRODUTO", "NOM_ATRIBUTO", "VAL_ATRIBUTO"]

# Lista dos 80 atributos pivotados, equivalente a clausula IN do PIVOT do
# Macro02 (Node1).
_ATRIBUTO_COLS = ",\n".join(
    f"'VAL_ATRIBUTO_{i:03d}' AS VAL_ATRIBUTO_{i:03d}" for i in range(1, 81)
)

# Equivalente a query do Node1 do Macro02 (LISTAGG + PIVOT).
PIVOT_ATRIBUTOS_SQL = f"""
SELECT *
FROM (SELECT TO_CHAR(SYSDATE, 'DD/MM/YYYY') AS DAT_MOVIMENTO
            ,COD_BASE
            ,COD_PRODUTO
            ,NOM_PRODUTO
            ,NOM_COLUNA
            ,LISTAGG(VAL_ATRIBUTO, '|') WITHIN GROUP (ORDER BY VAL_ATRIBUTO) AS VAL_ATRIBUTO
      FROM (SELECT A.COD_BASE
                  ,A.COD_PRODUTO
                  ,A.NOM_PRODUTO
                  ,A.NOM_ATRIBUTO
                  ,A.VAL_ATRIBUTO
                  ,REPLACE(B.DSC_ATRIBUTO, 'NOM_', 'VAL_') AS NOM_COLUNA
            FROM {TMP_TABLE} A
              INNER JOIN {ATRIBUTO_LISTA_TABLE} B
                      ON B.IND_CARREGAR_ATRIBUTO = 'S'
                     AND B.VAL_ATRIBUTO = A.NOM_ATRIBUTO
           )
      GROUP BY COD_BASE
              ,COD_PRODUTO
              ,NOM_PRODUTO
              ,NOM_COLUNA) A
PIVOT (MAX(VAL_ATRIBUTO) FOR NOM_COLUNA IN (
{_ATRIBUTO_COLS}))
"""


def execute_statement(spark: SparkSession, conn: JdbcConn, sql: str) -> None:
    """Executa DDL/CALL via JDBC direto (java.sql), fora do DataFrameReader
    do Spark, que so suporta queries de leitura/escrita de dados."""
    jvm = spark._jvm
    jvm.Class.forName(conn.driver)
    connection = jvm.java.sql.DriverManager.getConnection(conn.url, conn.user, conn.password)
    try:
        statement = connection.createStatement()
        try:
            statement.execute(sql)
            connection.commit()
        finally:
            statement.close()
    finally:
        connection.close()


def read_jdbc(spark: SparkSession, conn: JdbcConn, query: str) -> DataFrame:
    return (
        spark.read.format("jdbc")
        .option("url", conn.url)
        .option("user", conn.user)
        .option("password", conn.password)
        .option("driver", conn.driver)
        .option("query", query)
        .load()
    )


def write_jdbc(df: DataFrame, conn: JdbcConn, table: str, mode: str) -> None:
    (
        df.write.format("jdbc")
        .option("url", conn.url)
        .option("user", conn.user)
        .option("password", conn.password)
        .option("driver", conn.driver)
        .option("dbtable", table)
        .mode(mode)
        .save()
    )


def apaga_tabela_destino(spark: SparkSession) -> None:
    logger.info("Limpando tabela de destino %s", TARGET_TABLE)
    execute_statement(spark, STAGE_CONN, TRUNCATE_TARGET_SQL)


def extrai_atributos_produto(spark: SparkSession) -> DataFrame:
    logger.info("Extraindo atributos de produto da base legado")

    # Equivalente ao Node2 (Summarize GroupBy CD_BASE, ID_PRODUTO, NM_PRODUTO):
    # dedupe pelas 3 colunas, nao so pela chave CD_BASE+COD_PRODUTO - um
    # mesmo produto pode aparecer em mais de uma tabela de origem com
    # variacoes no nome, e o Alteryx mantem essas variacoes como produtos
    # distintos ate o dedupe final.
    produtos = read_jdbc(spark, LEGADO_CONN, PRODUTOS_SQL).dropDuplicates(
        ["COD_BASE", "COD_PRODUTO", "NOM_PRODUTO"]
    )
    rel_produto = read_jdbc(spark, LEGADO_CONN, REL_PRODUTO_SQL)
    rel_parametro = read_jdbc(spark, LEGADO_CONN, REL_PARAMETRO_SQL)
    atributos = read_jdbc(spark, LEGADO_CONN, ATRIBUTOS_SQL)

    df = (
        produtos.join(rel_produto, on=["COD_BASE", "COD_PRODUTO"], how="inner")
        .join(rel_parametro, on=["COD_BASE", "ID_ATRIBUTO_PARAMETRO"], how="inner")
        .join(atributos, on=["COD_BASE", "ID_ATRIBUTO"], how="inner")
        .select(*EXTRACAO_ATRIBUTOS_COLS)
        # Equivalente ao Node19 (Summarize GroupBy final) - sem esse dedupe
        # o join produz mais linhas que o Alteryx sempre que duas variantes
        # de produto (do dedupe acima) acabam com o mesmo atributo/valor.
        .dropDuplicates(EXTRACAO_ATRIBUTOS_COLS)
    )

    write_jdbc(df, STAGE_CONN, TMP_TABLE, mode="overwrite")
    logger.info("Tabela %s carregada com %d registros.", TMP_TABLE, df.count())
    return df


def pivota_e_grava_destino(spark: SparkSession) -> DataFrame:
    logger.info("Fazendo pivot dos atributos e gravando tabela final")
    df = read_jdbc(spark, STAGE_CONN, PIVOT_ATRIBUTOS_SQL)
    write_jdbc(df, STAGE_CONN, TARGET_TABLE, mode="append")
    logger.info("Tabela %s carregada com %d registros.", TARGET_TABLE, df.count())
    return df


def main() -> None:
    spark = SparkSession.builder.appName("WF_NBAO_022501_PRODUTO_ATRIBUTO").getOrCreate()
    try:
        apaga_tabela_destino(spark)
        extrai_atributos_produto(spark)
        pivota_e_grava_destino(spark)
    finally:
        spark.stop()


if __name__ == "__main__":
    main()
