module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/bookmarks/:dwellingId/:userId',
      handler: 'bookmark.createBookmark',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/bookmarks/users/:id',
      handler: 'bookmark.getUserBookmarks',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
}
