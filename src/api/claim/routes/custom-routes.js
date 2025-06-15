module.exports = {
  routes: [
    {
      method: 'PUT',
      path: '/claims/:id/approve',
      handler: 'claim.updateApproval',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
}
