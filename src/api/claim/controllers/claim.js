'use strict'

/**
 * claim controller
 */

const { createCoreController } = require('@strapi/strapi').factories

module.exports = createCoreController('api::claim.claim', ({ strapi }) => ({
  async updateApproval(ctx) {
    const { id } = ctx.request.params

    const foundedClaim = await strapi.entityService.findOne(
      'api::claim.claim',
      id,
      {
        populate: ['listing', 'user'],
      }
    )

    if (!foundedClaim?.id) {
      return ctx.notFound()
    }

    if (foundedClaim.approved) {
      return ctx.badRequest('Claim already approved')
    }

    // find all related claims
    const relatedClaims = await strapi.entityService.findMany(
      'api::claim.claim',
      {
        filters: {
          id: {
            $ne: foundedClaim.id,
          },
          listing: {
            $eq: foundedClaim.listing.id,
          },
        },
      }
    )

    // update all related claims
    for (const claim of relatedClaims) {
      await strapi.entityService.update('api::claim.claim', claim.id, {
        data: {
          isApproved: false,
        },
      })
    }

    await strapi.entityService.update(
      'api::dwelling.dwelling',
      foundedClaim.listing.id,
      {
        data: {
          owner: foundedClaim.user.id,
        },
      }
    )

    const updatedClaim = await strapi.entityService.update(
      'api::claim.claim',
      id,
      {
        data: {
          isApproved: true,
        },
      }
    )

    return updatedClaim
  },
}))
