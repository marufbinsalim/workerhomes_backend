'use strict'

/**
 * bookmark controller
 */

const { createCoreController } = require('@strapi/strapi').factories

module.exports = createCoreController(
  'api::bookmark.bookmark',
  ({ strapi }) => ({
    async createBookmark(ctx) {
      const { dwellingId, userId } = ctx.params

      if (!dwellingId || !userId) {
        return ctx.badRequest('Missing required parameters')
      }

      // find if bookmark already exists
      const existingBookmark = await strapi.entityService.findMany(
        'api::bookmark.bookmark',
        {
          filters: {
            $and: [
              {
                dwelling: {
                  id: {
                    $eq: dwellingId,
                  },
                },
              },
              {
                user: {
                  id: {
                    $eq: userId,
                  },
                },
              },
            ],
          },
        }
      )

      if (existingBookmark?.length > 0) {
        const removedBookmark = await strapi.entityService.delete(
          'api::bookmark.bookmark',
          existingBookmark?.[0]?.id
        )

        return { ...removedBookmark, action: 'REMOVED' }
      } else {
        const bookmark = await strapi.entityService.create(
          'api::bookmark.bookmark',
          {
            data: {
              dwelling: dwellingId,
              user: userId,
              publishedAt: new Date(),
            },
          }
        )

        return { ...bookmark, action: 'CREATED' }
      }
    },
    async getUserBookmarks(ctx) {
      const { id } = ctx.params

      if (!id) {
        return ctx.badRequest('Missing required parameters')
      }

      const bookmarks = await strapi.entityService.findMany(
        'api::bookmark.bookmark',
        {
          filters: {
            user: {
              id: {
                $eq: id,
              },
            },
          },
          populate: [
            'dwelling.galleries.image',
            'dwelling.category',
            'dwelling.location.city',
            'dwelling.prices',
            'dwelling.features.icon',
            'dwelling.subscription.package',
          ],
        }
      )

      return { data: bookmarks, user: parseInt(id) }
    },
  })
)
