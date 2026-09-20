// Configuração de monorepo: o app vive em apps/mobile, mas importa tipos
// compartilhados de packages/shared, fora da raiz padrão do Metro. Sem isso,
// o bundler recusa resolver/observar arquivos fora de apps/mobile.
// https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
