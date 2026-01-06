module.exports = function (api) {
  api.cache(true);
  return {
    // Expo preset already includes the React Native preset; keep it single to avoid duplicate JSX helpers
    presets: ["babel-preset-expo"],
  };
};
