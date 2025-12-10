const { getDefaultConfig } = require("expo/metro-config");

// Default Expo Metro config is enough once we render SVGs via SvgXml (no custom transformer needed)
module.exports = getDefaultConfig(__dirname);
