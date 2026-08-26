"""
PERFIL_USUARIO.py

Conversão para PySpark do fluxo Alteryx:
  - WF.NBAO.020715.PERFIL.USUARIO.yxmd  (workflow principal)
  - Macro.NBA.020715.00.yxmc  (truncagem da tabela final)
  - Macro.NBA.020715.01.yxmc  (carga da lista de perfis distintos)
  - Macro.NBA.020715.02.yxmc  (relacionamento perfil x tipo de solicitação x produto)
  - Macro.NBA.020715.03.yxmc  (carga final na tabela de staging)

Objetivo do módulo (herdado da documentação do .yxmd):
    Relacionamento entre os perfis e os produtos que podem ser ofertados.

Entradas:
    NBA_O.NBA_CRG_PERFIL_CANAL              (conexão ALTERYX_P01NBA)
    NETRDM.PR_PERFIL                        (conexão ALTERYX_NETCDM)
    NETRDM.PR_NIVEL_OPER                    (conexão ALTERYX_NETCDM)
    NETRDM.PR_SN_DEPTO                      (conexão ALTERYX_NETCDM)
    NETRDM.SN_REL_TIPO_SOLIC_DEPTO          (conexão ALTERYX_NETCDM)
    NETRDM.SN_TIPO_SOLIC_PROD               (conexão ALTERYX_NETCDM)
    SQOOP.PR_REL_PERFIL_NIVEL_OPER          (conexão ALTERYX_NETCDM)
    MDWALTERYXPRD.BI_DIM_PRODUTO_PRECO_TABELA (conexão ALTERYX_NETCDM)

Saída:
    NBA_O.NBA_STG_PRODUTO_PERFIL            (conexão ALTERYX_P01NBA)

Todas as consultas são executadas via JDBC (pushdown de SQL) e o resultado de
cada etapa é carregado em um DataFrame Spark. As tabelas de apoio
(NBA_TMP_DSC_PERFIL e NBA_TMP_PRODUTO_PERFIL) são persistidas via JDBC na
mesma conexão ALTERYX_NETCDM usada no fluxo original, preservando o
comportamento do módulo Alteryx.
"""

import logging

from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("WF_NBAO_020715_PERFIL_USUARIO")


# ---------------------------------------------------------------------------
# Configuração das conexões JDBC
# ---------------------------------------------------------------------------
# ALTERYX_P01NBA: base de origem/destino do módulo (schema NBA_O) e onde reside
# a stored procedure de truncagem NBA_O.NBA_TRUNC_TABLE.
JDBC_P01NBA = {
    "url": "jdbc:oracle:thin:@//<host_p01nba>:1521/<service_p01nba>",
    "driver": "oracle.jdbc.OracleDriver",
    "user": "<usuario_p01nba>",
    "password": "<senha_p01nba>",
}

# ALTERYX_NETCDM: base onde residem os schemas NETRDM, SQOOP, MDWALTERYXPRD e
# as tabelas de apoio (staging) NBA_TMP_DSC_PERFIL / NBA_TMP_PRODUTO_PERFIL.
JDBC_NETCDM = {
    "url": "jdbc:oracle:thin:@//<host_netcdm>:1521/<service_netcdm>",
    "driver": "oracle.jdbc.OracleDriver",
    "user": "<usuario_netcdm>",
    "password": "<senha_netcdm>",
}

TABELA_TMP_DSC_PERFIL = "NBA_TMP_DSC_PERFIL"
TABELA_TMP_PRODUTO_PERFIL = "NBA_TMP_PRODUTO_PERFIL"
TABELA_FINAL = "NBA_O.NBA_STG_PRODUTO_PERFIL"

# Lista de produtos excluídos do relacionamento perfil x produto, conforme
# filtro do Macro.NBA.020715.02 ("Filter" - Macro.NBA.020715.02.yxmc).
PRODUTOS_EXCLUIDOS = (
    11040, 18140, 19224, 19226, 30149, 30151, 30159, 30160, 30861, 31388, 31469, 31470,
    32148, 32149, 32152, 32157, 32173, 32176, 32438, 32439, 32440, 32441, 32442, 32444,
    32447, 32582, 33002, 33006, 36861, 36862, 36863, 36949, 36958, 36959, 36960, 36980,
    37036, 41262, 41795, 51049, 51059, 51073, 51306, 51333, 51339, 51341, 51367, 51369,
    51383, 51391, 51423, 51450, 51476, 51579, 51845, 51846, 51850, 51983, 52209, 52210,
    52267, 52328, 27716, 27717, 27718, 30864, 30867, 30873, 32358, 32359, 32361, 32524,
    32532, 32581, 32760, 32761, 36696, 36698, 36702, 36705, 36934, 36935, 36937, 36939,
    36954, 36976, 40766, 40831, 41790, 41794, 41796, 44000, 44001, 45145, 51057, 51058,
    51268, 51293, 51295, 51308, 51309, 51310, 51311, 51312, 51319, 51323, 51325, 51409,
    51411, 51413, 51421, 51433, 51435, 51444, 51446, 51454, 51458, 51460, 51469, 51471,
    51548, 51551, 51553, 51555, 51556, 51559, 51564, 51572, 51586, 51589, 51590, 51593,
    51609, 51716, 51720, 51725, 51729, 51733, 51748, 51751, 51767, 51768, 51771, 51813,
    51815, 51872, 51875, 51885, 51888, 51890, 51894, 51902, 51904, 51906, 51907, 51910,
    51917, 52051, 52052, 52053, 52206, 52266, 53038, 53039, 53050, 53051, 53056, 53057,
    53058, 53059, 53141, 53142, 53143, 53144, 53150, 53152, 53154, 53155, 30991, 51343,
    53185, 41373, 51048, 53203, 53207, 42206, 42905, 51581,
)

# Perfis excluídos do relacionamento perfil x produto (mesmo filtro acima).
PERFIS_EXCLUIDOS = (
    "CRN_RETENCAO_MOG_NBA",
    "CRN_RETENCAO_MOG",
    "CRN_SQUADCHURN_NEOBPO",
    "CRN_RETENCAO_MOG_NEW",
)


# ---------------------------------------------------------------------------
# Funções utilitárias de acesso JDBC
# ---------------------------------------------------------------------------
def get_spark() -> SparkSession:
    return SparkSession.builder.appName("WF_NBAO_020715_PERFIL_USUARIO").getOrCreate()


def read_query(spark: SparkSession, conn: dict, query: str) -> DataFrame:
    """Executa uma query via JDBC (pushdown) e retorna o resultado como DataFrame."""
    return (
        spark.read.format("jdbc")
        .option("url", conn["url"])
        .option("driver", conn["driver"])
        .option("user", conn["user"])
        .option("password", conn["password"])
        .option("query", query)
        .load()
    )


def write_table(df: DataFrame, conn: dict, table: str, mode: str) -> None:
    """Grava um DataFrame em uma tabela via JDBC (overwrite ou append)."""
    (
        df.write.format("jdbc")
        .option("url", conn["url"])
        .option("driver", conn["driver"])
        .option("user", conn["user"])
        .option("password", conn["password"])
        .option("dbtable", table)
        .mode(mode)
        .save()
    )


def execute_statement(spark: SparkSession, conn: dict, sql: str) -> None:
    """
    Executa DDL/DML/stored procedures via JDBC puro, já que spark.read.jdbc só
    suporta comandos que retornam ResultSet (SELECT). Usado aqui para chamar a
    procedure de truncagem, equivalente ao PostSQL do DbFileInput do Alteryx.
    """
    jvm = spark._jvm
    conn_jdbc = jvm.java.sql.DriverManager.getConnection(conn["url"], conn["user"], conn["password"])
    try:
        stmt = conn_jdbc.createStatement()
        try:
            stmt.execute(sql)
        finally:
            stmt.close()
    finally:
        conn_jdbc.close()


# ---------------------------------------------------------------------------
# Etapa 00 (Macro.NBA.020715.00): trunca a tabela final NBA_STG_PRODUTO_PERFIL
# ---------------------------------------------------------------------------
def limpa_tabela_produto_perfil(spark: SparkSession) -> None:
    execute_statement(spark, JDBC_P01NBA, "CALL NBA_O.NBA_TRUNC_TABLE('NBA_STG_PRODUTO_PERFIL')")
    logger.info("Tabela NBA_STG_PRODUTO_PERFIL truncada.")


# ---------------------------------------------------------------------------
# Etapa 01 (Macro.NBA.020715.01): perfis distintos cadastrados em NBA_CRG_PERFIL_CANAL
# ---------------------------------------------------------------------------
def carrega_tmp_dsc_perfil(spark: SparkSession) -> DataFrame:
    query = """
        SELECT DISTINCT DSC_PERFIL_OPERADOR AS DSC_PERFIL
        FROM NBA_O.NBA_CRG_PERFIL_CANAL
    """
    df = read_query(spark, JDBC_P01NBA, f"({query})")

    write_table(df, JDBC_NETCDM, TABELA_TMP_DSC_PERFIL, mode="overwrite")
    logger.info("Tabela NBA_TMP_DSC_PERFIL carregada com %d registros.", df.count())
    return df


# ---------------------------------------------------------------------------
# Etapa 02 (Macro.NBA.020715.02): relacionamento perfil x tipo de solicitação x produto
#
# Reproduz os dois componentes "Connect In-DB" da macro (perfil/departamento e
# tipo de solicitação/produto) como dois DataFrames independentes; o Join, o
# Filter e o Summarize(GroupBy) do Alteryx são feitos via API de DataFrame,
# em vez de um único SQL combinado.
# ---------------------------------------------------------------------------
def carrega_perfil_departamento(spark: SparkSession) -> DataFrame:
    """Connect In-DB (1): perfis válidos e o departamento associado."""
    query = f"""
        SELECT A.CD_BASE, A.NOME_PERFIL, D.ID_DEPTO
        FROM NETRDM.PR_PERFIL A
        INNER JOIN {TABELA_TMP_DSC_PERFIL} B
                ON B.DSC_PERFIL = A.NOME_PERFIL
        INNER JOIN SQOOP.PR_REL_PERFIL_NIVEL_OPER C
                ON C.FL_STATUS_BI = 'A'
               AND C.CD_BASE = A.CD_BASE
               AND C.ID_PERFIL = A.ID_PERFIL
        INNER JOIN NETRDM.PR_SN_DEPTO D
                ON D.FL_STATUS_BI = 'A'
               AND D.CD_BASE = C.CD_BASE
               AND D.ID_NIVEL_OPER = C.ID_NIVEL_OPER
        INNER JOIN NETRDM.PR_NIVEL_OPER E
                ON E.FL_STATUS_BI = 'A'
               AND E.ID_SIS = 1
               AND E.CD_BASE = D.CD_BASE
               AND E.ID_NIVEL_OPER = D.ID_NIVEL_OPER
        WHERE A.FL_STATUS_BI = 'A'
          AND A.CD_BASE != 'CTV'
    """
    return read_query(spark, JDBC_NETCDM, f"({query})")


def carrega_tipo_solic_produto(spark: SparkSession) -> DataFrame:
    """Connect In-DB (3): tipos de solicitação e produtos elegíveis por departamento."""
    query = """
        SELECT DISTINCT
            A.CD_BASE,
            A.ID_TIPO_SOLIC,
            B.ID_PRODUTO,
            C.ID_DEPTO
        FROM NETRDM.SN_TIPO_SOLIC_PROD A
        INNER JOIN (
            SELECT DISTINCT CD_BASE, ID_PRODUTO
            FROM MDWALTERYXPRD.BI_DIM_PRODUTO_PRECO_TABELA
        ) B
                ON B.CD_BASE = A.CD_BASE
               AND B.ID_PRODUTO = A.ID_PROD_PARA
        INNER JOIN NETRDM.SN_REL_TIPO_SOLIC_DEPTO C
                ON C.FL_STATUS_BI = 'A'
               AND C.ACAO = 1
               AND C.CD_BASE = A.CD_BASE
               AND C.ID_TIPO_SOLIC_PROD = A.ID_TIPO_SOLIC_PROD
        WHERE A.FL_STATUS_BI = 'A'
          AND A.CD_BASE != 'CTV'
          AND A.ID_TIPO_SOLIC IN (3, 24, 26, 917)
    """
    return read_query(spark, JDBC_NETCDM, f"({query})")


def carrega_tmp_produto_perfil(spark: SparkSession) -> DataFrame:
    df_perfil_depto = carrega_perfil_departamento(spark)
    df_tipo_solic_produto = carrega_tipo_solic_produto(spark)

    # Join (Inner) do Macro.NBA.020715.02: CD_BASE + ID_DEPTO.
    df_join = df_perfil_depto.join(
        df_tipo_solic_produto,
        on=["CD_BASE", "ID_DEPTO"],
        how="inner",
    )

    # Filter: exclui a combinação produto x perfil do NETSMS informada na macro.
    df_filtrado = df_join.filter(
        ~(
            F.col("ID_PRODUTO").isin(*PRODUTOS_EXCLUIDOS)
            & F.col("NOME_PERFIL").isin(*PERFIS_EXCLUIDOS)
        )
    )

    # Select + Summarize(GroupBy) => rename de colunas e distinct.
    df = (
        df_filtrado.select(
            F.col("CD_BASE").alias("COD_BASE"),
            F.col("NOME_PERFIL").alias("DSC_PERFIL"),
            F.col("ID_TIPO_SOLIC").alias("COD_TIPO_SOLIC"),
            F.col("ID_PRODUTO").alias("COD_PRODUTO"),
        )
        .distinct()
    )

    write_table(df, JDBC_NETCDM, TABELA_TMP_PRODUTO_PERFIL, mode="overwrite")
    logger.info("Tabela NBA_TMP_PRODUTO_PERFIL carregada com %d registros.", df.count())
    return df


# ---------------------------------------------------------------------------
# Etapa 03 (Macro.NBA.020715.03): carga final em NBA_O.NBA_STG_PRODUTO_PERFIL
# ---------------------------------------------------------------------------
def carrega_produto_perfil_final(spark: SparkSession) -> DataFrame:
    query = f"""
        SELECT
            COD_BASE,
            DSC_PERFIL     AS NOM_PERFIL,
            COD_TIPO_SOLIC AS COD_TIP_SOLIC,
            COD_PRODUTO,
            TO_CHAR(SYSDATE, 'DD/MM/YYYY') AS DAT_MOVIMENTO,
            'ENTRADA' AS TIP_ACAO,
            '-1'      AS DSC_PRODUTO
        FROM {TABELA_TMP_PRODUTO_PERFIL}
    """
    df = read_query(spark, JDBC_NETCDM, f"({query})")

    write_table(df, JDBC_P01NBA, TABELA_FINAL, mode="append")
    logger.info("Tabela NBA_STG_PRODUTO_PERFIL carregada com %d registros.", df.count())
    return df


# ---------------------------------------------------------------------------
# Orquestração (equivalente ao workflow WF.NBAO.020715.PERFIL.USUARIO.yxmd)
# ---------------------------------------------------------------------------
def main() -> None:
    spark = get_spark()
    try:
        limpa_tabela_produto_perfil(spark)
        carrega_tmp_dsc_perfil(spark)
        carrega_tmp_produto_perfil(spark)
        carrega_produto_perfil_final(spark)
    finally:
        spark.stop()


if __name__ == "__main__":
    main()
