module.exports = {
  routes: [
    {
      method: 'PUT',
      path: '/dwellings/:id/status',
      handler: 'dwelling.updateStatus',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/dwellings/:id/subscription',
      handler: 'dwelling.updateSubscription',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/dwellings/available',
      handler: 'dwelling.getAllAvailable',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/dwellings/:id/modify-images',
      handler: 'dwelling.modifyImages',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/dwellings/all/:locale',
      handler: 'dwelling.getAllItems',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/dwellings/:id/sync',
      handler: 'dwelling.syncTranslations',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/dwellings/:id/viewed',
      handler: 'dwelling.updateViewed',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/sitemap',
      handler: 'dwelling.getSitemap',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
}
