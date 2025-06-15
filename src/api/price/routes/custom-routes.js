module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/prices/modify',
      handler: 'price.createMany',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
}
