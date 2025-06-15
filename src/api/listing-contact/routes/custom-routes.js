module.exports = {
  routes: [
    {
      method: 'PUT',
      path: '/listing-contacts/:id/response',
      handler: 'listing-contact.updateResponse',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
}
