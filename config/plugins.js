module.exports = ({ env }) => ({
  seo: {
    enabled: true,
  },
  transformer: {
    enabled: true,
    config: {
      responseTransforms: {
        removeAttributesKey: true,
        removeDataKey: true,
      },
      // requestTransforms: {
      //   wrapBodyWithDataKey: true,
      // },

      // hooks: {
      //   preResponseTransform: (ctx) =>
      //     console.log("hello from the preResponseTransform hook!"),
      //   postResponseTransform: (ctx) =>
      //     console.log("hello from the postResponseTransform hook!"),
      // },
      plugins: {},
    },
  },
  email: {
    config: {
      provider: "sendgrid",
      providerOptions: {
        apiKey: env("SENDGRID_API_KEY"),
      },
      settings: {
        defaultFrom: "joya.abn@gmail.com",
        defaultReplyTo: "joya.abn@gmail.com",
        testAddress: "joya.abn@gmail.com",
      },
    },
  },
});
