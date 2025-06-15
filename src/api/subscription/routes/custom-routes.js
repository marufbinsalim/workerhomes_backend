module.exports = {
  routes: [
    {
      method: 'PUT',
      path: '/upgrade-package',
      handler: 'subscription.upgradePackage',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/downgrade-package',
      handler: 'subscription.downgradePackage',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/assign-dwelling',
      handler: 'subscription.assignDwelling',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/subscriptions/free-trail',
      handler: 'subscription.createFreeTrail',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
}
