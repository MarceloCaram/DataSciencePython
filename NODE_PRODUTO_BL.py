"""
Conversao do fluxo Alteryx WF.NBAO.022415.NODE.PRODUTO.BL (+ macros
NBA.Macro.Limpa.Tabela, NBA.Macro.022415.Node.Produto.BL e
Macro.Grava.Dados) para PySpark.

Etapas:
  1. Limpa a tabela de destino na base destino (equivalente a
     NBA.Macro.Limpa.Tabela).
  2. Extrai e junta AGRUPAMENTO_PRODUTO, AGRUPAMENTO e AGRUPAMENTO_NODE na
     base origem (equivalente a NBA.Macro.022415.Node.Produto.BL).
  3. Adiciona as colunas de data de carga e grava na tabela final
     (equivalente a Macro.Grava.Dados).

Conexao com os bancos via JDBC (Oracle). Toda a logica de negocio foi
mantida em SQL; o Python apenas orquestra execucao e carrega os resultados
em DataFrames. A deteccao automatica de ambiente (PROD/DEV) que o fluxo
original faz consultando o usuario do banco foi substituida por parametros
explicitos via variaveis de ambiente.
"""

import logging
import os
from dataclasses import dataclass

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.functions import date_format, current_date

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("NODE_PRODUTO_BL")


@dataclass
class JdbcConn:
    url: str
    user: str
    password: str
    driver: str = "oracle.jdbc.OracleDriver"


# Conexoes equivalentes as conexoes Alteryx DSC_CONEXAO_ORIGEM (PROD:
# ALTERYX_NETCDM) e DSC_CONEXAO_DESTINO (PROD: ALTERYX_P01NBA).
SOURCE_CONN = JdbcConn(
    url=os.environ["SOURCE_JDBC_URL"],
    user=os.environ["SOURCE_JDBC_USER"],
    password=os.environ["SOURCE_JDBC_PASSWORD"],
    driver=os.environ.get("SOURCE_JDBC_DRIVER", "oracle.jdbc.OracleDriver"),
)

TARGET_CONN = JdbcConn(
    url=os.environ["TARGET_JDBC_URL"],
    user=os.environ["TARGET_JDBC_USER"],
    password=os.environ["TARGET_JDBC_PASSWORD"],
    driver=os.environ.get("TARGET_JDBC_DRIVER", "oracle.jdbc.OracleDriver"),
)

# Owners equivalentes a DSC_OWNER_ORIGEM (PROD: NETRDM) e DSC_OWNER_DESTINO
# (PROD: NBA_O), e a DSC_TABELA_FINAL do TextInput do workflow principal.
SOURCE_SCHEMA = os.environ.get("SOURCE_SCHEMA", "NETRDM")
TARGET_SCHEMA = os.environ.get("TARGET_SCHEMA", "NBA_O")
TARGET_TABLE_NAME = "NBA_STG_NODE_PRODUTO_BL"

TARGET_TABLE = f"{TARGET_SCHEMA}.{TARGET_TABLE_NAME}"

# Equivalente ao PostSQL de NBA.Macro.Limpa.Tabela.
TRUNCATE_TARGET_SQL = f"CALL {TARGET_SCHEMA}.NBA_TRUNC_TABLE('{TARGET_TABLE_NAME}')"

# Equivalente aos Nodes 18/19/24, 20/21/25, 22/23 (fontes + filtros de
# vigencia/ativo) e aos Joins 30/32 + Summarize 29 (dedupe final) de
# NBA.Macro.022415.Node.Produto.BL.
EXTRACAO_NODE_PRODUTO_SQL = f"""
WITH AGRUPAMENTO_PRODUTO AS (
    SELECT CD_BASE AS COD_BASE, ID_AGRUPAMENTO AS COD_AGRUPAMENTO, ID_PRODUTO AS COD_PRODUTO
    FROM {SOURCE_SCHEMA}.AGRUPAMENTO_PRODUTO
    WHERE DT_INICIO <= TRUNC(SYSDATE)
      AND DT_FIM > TRUNC(SYSDATE)
),
AGRUPAMENTO AS (
    SELECT CD_BASE AS COD_BASE, ID_AGRUPAMENTO AS COD_AGRUPAMENTO, CID_CONTRATO AS COD_CIDADE
    FROM {SOURCE_SCHEMA}.AGRUPAMENTO
    WHERE DT_INICIO <= TRUNC(SYSDATE)
      AND DT_FIM > TRUNC(SYSDATE)
      AND FC_ATIVO = 'S'
),
AGRUPAMENTO_NODE AS (
    SELECT CD_BASE AS COD_BASE, ID_AGRUPAMENTO AS COD_AGRUPAMENTO, COD_NODE, COD_OPERADORA
    FROM {SOURCE_SCHEMA}.AGRUPAMENTO_NODE
)
SELECT DISTINCT
       AP.COD_BASE,
       AP.COD_PRODUTO,
       AN.COD_NODE,
       A.COD_CIDADE,
       AN.COD_OPERADORA
FROM AGRUPAMENTO_PRODUTO AP
INNER JOIN AGRUPAMENTO A
        ON A.COD_BASE = AP.COD_BASE
       AND A.COD_AGRUPAMENTO = AP.COD_AGRUPAMENTO
INNER JOIN AGRUPAMENTO_NODE AN
        ON AN.COD_BASE = A.COD_BASE
       AND AN.COD_AGRUPAMENTO = A.COD_AGRUPAMENTO
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


def limpa_tabela_destino(spark: SparkSession) -> None:
    logger.info("Limpando tabela de destino %s", TARGET_TABLE)
    execute_statement(spark, TARGET_CONN, TRUNCATE_TARGET_SQL)
    logger.info("Tabela %s truncada.", TARGET_TABLE_NAME)


def extrai_node_produto_bl(spark: SparkSession) -> DataFrame:
    logger.info("Extraindo node x produto BL da base origem")
    return read_jdbc(spark, SOURCE_CONN, EXTRACAO_NODE_PRODUTO_SQL)


def grava_dados(df: DataFrame) -> None:
    logger.info("Gravando dados na tabela final %s", TARGET_TABLE)
    hoje = date_format(current_date(), "dd/MM/yyyy")
    df_final = df.withColumn("DAT_MOVIMENTO", hoje).withColumn("DAT_REF", hoje).withColumn(
        "DAT_CARGA", hoje
    )
    write_jdbc(df_final, TARGET_CONN, TARGET_TABLE, mode="append")
    logger.info("Tabela %s carregada com sucesso.", TARGET_TABLE_NAME)


def main() -> None:
    spark = SparkSession.builder.appName("WF_NBAO_022415_NODE_PRODUTO_BL").getOrCreate()
    try:
        limpa_tabela_destino(spark)
        df = extrai_node_produto_bl(spark)
        grava_dados(df)
    finally:
        spark.stop()


if __name__ == "__main__":
    main()
