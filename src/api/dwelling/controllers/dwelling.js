'use strict'

const translate = require('deepl')
const slugify = require('slugify')
const { filter } = require('../../../../config/middlewares')

/**
 * dwelling controller
 */

const translateText = async (text, targetLanguage = 'EN') => {
  try {
    const response = await translate({
      auth_key: process.env.DEEPL_AUTH_KEY,
      text,
      target_lang: targetLanguage,
      free_api: true,
    })

    return response?.data?.translations?.[0]?.text
  } catch (error) {
    console.error('Error translating text:', error)
    throw error
  }
}

const groupDataByLocale = data => {
  const result = {}

  data?.forEach(item => {
    // Group main item by its locale
    if (!result[item?.locale]) {
      result[item?.locale] = []
    }
    result[item?.locale].push(item?.id)

    if (item?.localizations?.length > 0) {
      // Group localized versions of the item by their locales
      item?.localizations.forEach(localization => {
        if (!result[localization?.locale]) {
          result[localization?.locale] = []
        }
        result[localization?.locale].push(localization?.id)
      })
    } else {
      // If there are no localized versions of the item, add an empty array for each locale
      if (!result['en']) {
        result['en'] = []
      }
      if (!result['de']) {
        result['de'] = []
      }
      if (!result['pl']) {
        result['pl'] = []
      }
    }
  })

  return result
}

const genSlug = text => {
  const slug = slugify(text, {
    replacement: '-', // replace spaces with replacement character, defaults to `-`
    remove: undefined, // remove characters that match regex, defaults to `undefined`
    lower: true, // convert to lower case, defaults to `false`
    strict: false, // strip special characters except replacement, defaults to `false`
    locale: 'vi', // language code of the locale to use
    trim: true, // trim leading and trailing replacement chars, defaults to `true`
  })

  return `${slug}-${Math.floor(Math.random() * 100000)}`
}

const { createCoreController } = require('@strapi/strapi').factories

module.exports = createCoreController(
  'api::dwelling.dwelling',
  ({ strapi }) => ({
    async delete(ctx) {
      const { id } = ctx.request.params

      const foundedDwelling = await strapi.entityService.findOne(
        'api::dwelling.dwelling',
        id,
        {
          populate: ['localizations', 'subscription'],
        }
      )

      if (!foundedDwelling?.id) {
        return ctx.notFound('dwelling Not found')
      }

      if (foundedDwelling?.subscription?.id) {
        await strapi.entityService.delete(
          'api::subscription.subscription',
          foundedDwelling.subscription.id
        )
      }

      if (foundedDwelling?.localizations?.length > 0) {
        for (const loc of foundedDwelling.localizations) {
          await strapi.entityService.delete('api::dwelling.dwelling', loc.id)
        }
      }

      const res = await super.delete(ctx)

      return { data: { id: res.data?.id } }
    },
    async updateStatus(ctx) {
      const { id } = ctx.request.params
      const { data } = ctx.request.body

      const foundedDwelling = await strapi.entityService.findOne(
        'api::dwelling.dwelling',
        id,
        {
          populate: ['localizations', 'subscription'],
        }
      )

      if (!foundedDwelling) {
        return ctx.notFound()
      }

      if (foundedDwelling.status === data.status) {
        return ctx.badRequest('Status already set')
      }

      if (
        !foundedDwelling?.subscription?.id &&
        data?.status?.toString().toUpperCase() === 'AVAILABLE'
      ) {
        return ctx.badRequest('Subscription not found')
      }

      const obj = {
        status: data?.status?.toString().toUpperCase(),
      }

      if (data?.status?.toString().toUpperCase() === 'AVAILABLE') {
        obj.isApproved = true
      } else {
        obj.isApproved = false
      }

      const updatedDwelling = await strapi.entityService.update(
        'api::dwelling.dwelling',
        id,
        {
          data: obj,
        }
      )

      if (foundedDwelling?.localizations?.length > 0) {
        for (const loc of foundedDwelling.localizations) {
          await strapi.entityService.update('api::dwelling.dwelling', loc.id, {
            data: obj,
          })
        }
      }

      return updatedDwelling
    },
    async updateSubscription(ctx) {
      const { id } = ctx.request.params
      const { data } = ctx.request.body

      // 1: id (required)
      // 2: subscription (optional) # subscription id
      // 3: user (required) # user id
      // 4: isFreePlanAssigned (true|false)

      // check for current subscription
      const currentDwelling = await strapi.entityService.findOne(
        'api::dwelling.dwelling',
        id,
        {
          populate: ['subscription', 'localizations'],
        }
      )

      // check if dwelling exists
      if (!currentDwelling?.id) {
        return ctx.notFound()
      }

      // check if current user is exits
      if (!data?.user) {
        return ctx.badRequest('User not found')
      }

      const currentUser = await strapi.entityService.findOne(
        'plugin::users-permissions.user',
        data?.user
      )

      // check if current user is exits
      if (!currentUser?.id) {
        return ctx.badRequest('User not found')
      }

      if (data?.isFreePlanAssigned) {
        if (currentDwelling?.subscription?.isFree === true) {
          return ctx.badRequest('Subscription already set')
        }

        // find free plan
        const freePlan = await strapi.entityService.findMany(
          'api::package.package',
          {
            filters: {
              isFree: true,
            },
          }
        )

        if (freePlan?.length === 0) {
          return ctx.badRequest('Free plan not found')
        }

        // check if user has already free subscriptions
        const existedSubscriptions = await strapi.entityService.findMany(
          'api::subscription.subscription',
          {
            filters: {
              user: {
                $eq: currentUser?.id,
              },
              isFree: {
                $eq: true,
              },
              isExpired: {
                $eq: false,
              },
              dwellings: {
                $null: true,
              },
            },
          }
        )

        let subscription = null

        if (existedSubscriptions?.length > 0) {
          subscription = existedSubscriptions?.[0]
        } else {
          // create a new free subscription
          subscription = await strapi.entityService.create(
            'api::subscription.subscription',
            {
              data: {
                isFree: true,
                package: freePlan?.[0]?.id,
                user: currentUser?.id,
                start_date: new Date(),
                payment_status: 'free',
                stripe_customer_id: currentUser?.stripe_customer_id,
                stripe_product_id: freePlan?.[0]?.stripe_product_id,
                publishedAt: new Date(),
              },
            }
          )
        }

        // update the dwelling
        const updatedDwelling = await strapi.entityService.update(
          'api::dwelling.dwelling',
          id,
          {
            data: {
              subscription: subscription?.id,
              isFreePlanAssigned: data?.isFreePlanAssigned,
            },
          }
        )

        // update all localizations
        if (currentDwelling?.localizations?.length > 0) {
          for (const loc of currentDwelling.localizations) {
            await strapi.entityService.update(
              'api::dwelling.dwelling',
              loc.id,
              {
                data: {
                  subscription: subscription?.id,
                  isFreePlanAssigned: data?.isFreePlanAssigned,
                },
              }
            )
          }
        }

        return 'Free plan assigned successfully'
      } else {
        // check if subscription exists
        if (currentDwelling?.subscription?.id === data?.subscription) {
          return ctx.badRequest('Subscription already set')
        }

        // check if subscription exists
        const subscription = await strapi.entityService.findOne(
          'api::subscription.subscription',
          data?.subscription
        )

        if (!subscription?.id) {
          return ctx.badRequest('Subscription not found')
        }

        // update the dwelling
        const updatedDwelling = await strapi.entityService.update(
          'api::dwelling.dwelling',
          id,
          {
            data: {
              subscription: subscription?.id,
              isFreePlanAssigned: subscription?.isFree,
            },
          }
        )

        // update all localizations
        if (currentDwelling?.localizations?.length > 0) {
          for (const loc of currentDwelling.localizations) {
            await strapi.entityService.update(
              'api::dwelling.dwelling',
              loc.id,
              {
                data: {
                  subscription: data?.subscription,
                  isFreePlanAssigned: data?.isFreePlanAssigned,
                },
              }
            )
          }
        }

        return updatedDwelling
      }
    },
    async getAllAvailable(ctx) {
      const { data } = ctx.request.body

      const isRecommended = data?.isRecommended
      const isFeatured = data?.isFeatured
      const priceRange = data?.priceKey
      const priceSort = data?.priceSort ? data?.priceSort : 'asc'
      const adultRange = data?.adultKey
      const guestRange = data?.guestKey
      const locale = data?.locale ? data?.locale : 'en'

      const generatePriceFilter = price => {
        if (!price) return {}

        switch (price) {
          case 'LOWER_THAN_500':
            return {
              prices: {
                amount: {
                  $lt: 500,
                },
              },
            }
          case 'BETWEEN_500_AND_1000':
            return {
              prices: {
                amount: {
                  $gte: 500,
                  $lte: 1000,
                },
              },
            }
          case 'BETWEEN_1000_AND_2000':
            return {
              prices: {
                amount: {
                  $gte: 1000,
                  $lte: 2000,
                },
              },
            }

          case 'BETWEEN_2000_AND_3000':
            return {
              prices: {
                amount: {
                  $gte: 2000,
                  $lte: 3000,
                },
              },
            }
          case 'GREATER_THAN_3000':
            return {
              prices: {
                amount: {
                  $gt: 3000,
                },
              },
            }
          default:
            return {}
        }
      }

      const generateGuestFilter = number => {
        if (!number) return {}

        switch (number) {
          case 'LOWER_THAN_5':
            return {
              prices: {
                guest: {
                  $lt: 5,
                },
              },
            }
          case 'BETWEEN_5_AND_10':
            return {
              prices: {
                guest: {
                  $gte: 5,
                  $lte: 10,
                },
              },
            }
          case 'BETWEEN_10_AND_15':
            return {
              prices: {
                guest: {
                  $gte: 10,
                  $lte: 15,
                },
              },
            }
          case 'GREATER_THAN_15':
            return {
              prices: {
                guest: {
                  $gt: 15,
                },
              },
            }
          default:
            return {}
        }
      }

      const generateMiniumStayFilter = number => {
        if (!number) return {}

        switch (number) {
          case 'LOWER_THAN_5':
            return {
              prices: {
                min_stay: {
                  $lt: 5,
                },
              },
            }
          case 'BETWEEN_5_AND_10':
            return {
              prices: {
                min_stay: {
                  $gte: 5,
                  $lte: 10,
                },
              },
            }
          case 'BETWEEN_10_AND_15':
            return {
              prices: {
                min_stay: {
                  $gte: 10,
                  $lte: 15,
                },
              },
            }
          case 'GREATER_THAN_15':
            return {
              prices: {
                min_stay: {
                  $gt: 15,
                },
              },
            }
          default:
            return {}
        }
      }

      const filter = {
        isApproved: {
          $eq: true,
        },
        status: {
          $eq: 'AVAILABLE',
        },
        isRecommended: {
          $eq: isRecommended || undefined,
        },
        subscription: {
          package: {
            isFeatured: {
              $eq: isFeatured || undefined,
            },
          },
        },
        ...generatePriceFilter(priceRange),
        ...generateGuestFilter(guestRange),
        ...generateMiniumStayFilter(adultRange),
      }

      if (!isRecommended) {
        delete filter.isRecommended
      }

      if (!isFeatured) {
        delete filter.subscription
      }

      if (!priceRange) {
        delete filter.prices
      }

      if (!guestRange) {
        delete filter.prices
      }

      if (!adultRange) {
        delete filter.prices
      }

      const dwellings = await strapi.entityService.findMany(
        'api::dwelling.dwelling',
        {
          filters: filter,
          locale,
          populate: [
            'galleries.image',
            'location',
            'prices',
            'features.icon',
            'category',
            'subscription.package.icon',
          ],
          sort: [
            'subscription.package.search_position:asc',
            `prices.amount:${priceSort}`,
          ],
        }
      )

      return dwellings
    },
    async modifyImages(ctx) {
      const { id } = ctx.request.params
      const { data } = ctx.request.body

      const images = data?.images

      if (images?.length === 0) {
        return ctx.badRequest('Images are required')
      }

      images.forEach(async image => {
        if (!image?.id) {
          await strapi.entityService.create('api::gallery.gallery', {
            data: {
              dwellings: id,
              image: image?.image,
              isDefault: image?.isDefault,
              order: image?.order ? parseInt(image?.order) : 0,
              publishedAt: new Date(),
            },
          })
        } else {
          await strapi.entityService.update('api::gallery.gallery', image?.id, {
            data: {
              dwellings: id,
              order: image?.order ? parseInt(image?.order) : 0,
              isDefault: image?.isDefault,
            },
          })
        }
      })

      return images
    },
    async getAllItems(ctx) {
      const { locale } = ctx.request.params
      // const { data } = ctx.request.body

      // const today = new Date()
      // const oneYearAgo = new Date(today)
      // oneYearAgo.setFullYear(today.getFullYear() - 1)

      const dwellings = await strapi.entityService.findMany(
        'api::dwelling.dwelling',
        {
          locale,
          // filters: {
          //   createdAt: {
          //     $gt: oneYearAgo,
          //   },
          // },
        }
      )
      const subscriptions = await strapi.entityService.findMany(
        'api::subscription.subscription',
        {
          locale,
          populate: ['package'],
          // filters: {
          //   createdAt: {
          //     $gt: oneYearAgo,
          //   },
          //   isFree: {
          //     $nq: true,
          //   },
          // },
        }
      )
      const sessions = await strapi.entityService.findMany(
        'api::session.session',
        {
          locale,
          // filters: {
          //   createdAt: {
          //     $gt: oneYearAgo,
          //   },
          // },
        }
      )

      const users = await strapi.entityService.findMany(
        'plugin::users-permissions.user',
        {
          locale,
          // filters: {
          //   createdAt: {
          //     $gt: oneYearAgo,
          //   },
          // },
        }
      )

      const ctm =
        users?.length > 0
          ? users?.map(user => {
              return {
                id: user.id,
                name: user.name,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
              }
            })
          : []

      return {
        listings: dwellings,
        sales: subscriptions,
        sessions: sessions,
        customers: ctm,
        locale,
      }
    },
    async syncTranslations(ctx) {
      const { id } = ctx.request.params

      // Find the main dwelling
      const foundedDwelling = await strapi.entityService.findOne(
        'api::dwelling.dwelling',
        id,
        {
          populate: [
            'galleries',
            'amenities.localizations',
            'localizations',
            'features.localizations',
            'category.localizations',
            'prices',
            'location',
            'contact',
            'subscription',
            'listing_contacts',
            'claims',
            'owner',
            'seo.metaImage',
          ],
        }
      )

      if (!foundedDwelling) {
        return ctx.notFound()
      }

      const title = foundedDwelling?.title
      const desc = foundedDwelling?.description

      // Localized data
      const amenities = groupDataByLocale(foundedDwelling?.amenities)
      const features = groupDataByLocale(foundedDwelling?.features)
      const categories = groupDataByLocale([foundedDwelling?.category])
      const subscription = foundedDwelling?.subscription?.id || undefined
      const listing_contacts = foundedDwelling?.listing_contacts || undefined
      const claims = foundedDwelling?.claims || undefined
      const owner = foundedDwelling?.owner?.id || undefined
      const prices = foundedDwelling?.prices || undefined
      const galleries = foundedDwelling?.galleries || undefined

      const seo = foundedDwelling?.seo
      const location =
        foundedDwelling?.location?.length > 0
          ? foundedDwelling?.location?.map(l => ({
              zip_code: l?.zip_code || ' ',
              city: l?.city || ' ',
              geo: l?.geo,
              country: l?.country || ' ',
              street_one: l?.street_one || ' ',
              street_two: l?.street_two || ' ',
              state: l?.state || ' ',
            }))
          : []
      const contact =
        foundedDwelling?.location?.length > 0
          ? foundedDwelling?.contact?.map(cnt => ({
              type: cnt?.type,
              value: cnt?.value,
            }))
          : []

      // Check if there are already localizations
      const isLocalized = foundedDwelling?.localizations?.length > 0

      if (isLocalized) {
        // Update existing localizations
        for (const dwelling of foundedDwelling?.localizations) {
          const locale = dwelling?.locale.toUpperCase()

          await strapi.entityService.update(
            'api::dwelling.dwelling',
            dwelling.id,
            {
              data: {
                title: await translateText(title, locale),
                description: await translateText(desc, locale),
                slug: genSlug(await translateText(title, locale)),
                amenities: amenities?.[locale.toLowerCase()],
                features: features?.[locale.toLowerCase()],
                category: categories?.[locale.toLowerCase()]?.[0],
                claims,
                owner,
                subscription,
                location,
                contact,
                listing_contacts,
                prices,
                galleries,
                status: foundedDwelling?.status || 'PENDING',
                order: foundedDwelling?.order || 1,
                isTrended: foundedDwelling?.isTrended || false,
                isRecommended: foundedDwelling?.isRecommended || false,
                isPopulared: foundedDwelling?.isPopulared || false,
                count: foundedDwelling?.count || 1,
                isApproved: foundedDwelling?.isApproved || false,
                isFreePlanAssigned:
                  foundedDwelling?.isFreePlanAssigned || false,
                direction: foundedDwelling?.direction || '',
                service_lang: foundedDwelling?.service_lang || 'pl',

                seo:
                  seo?.length > 0
                    ? await Promise.all(
                        seo.map(async s => ({
                          metaTitle: await translateText(s?.metaTitle, locale),
                          metaDescription: await translateText(
                            s?.metaDescription,
                            locale
                          ),
                          metaImage: s?.metaImage?.id ? s?.metaImage : null,
                        }))
                      )
                    : [],
              },
            }
          )
        }

        await strapi.entityService.update(
          'api::dwelling.dwelling',
          foundedDwelling?.id,
          {
            data: {
              slug: genSlug(
                await translateText(title, foundedDwelling?.locale)
              ),
            },
          }
        )
      }

      return {
        success: true,
        status: 200,
        message: 'Translations synced',
      }
    },
    async updateViewed(ctx) {
      const { id } = ctx.request.params

      const foundedDwelling = await strapi.entityService.findOne(
        'api::dwelling.dwelling',
        id,
        {
          populate: ['localizations'],
        }
      )

      if (!foundedDwelling) {
        return ctx.notFound()
      }

      const currentCount = foundedDwelling?.count || 0

      const updatedDwelling = await strapi.entityService.update(
        'api::dwelling.dwelling',
        id,
        {
          data: {
            count: currentCount + 1,
          },
        }
      )

      if (foundedDwelling?.localizations?.length > 0) {
        // Group localized versions of the item by their locales
        foundedDwelling?.localizations.forEach(async localization => {
          await strapi.entityService.update(
            'api::dwelling.dwelling',
            localization?.id,
            {
              data: {
                count: currentCount + 1,
              },
            }
          )
        })
      }

      return {
        id: updatedDwelling?.id,
        count: updatedDwelling?.count,
        success: true,
        status: 200,
      }
    },
    async getSitemap(ctx) {
      const dwellings = await strapi.entityService.findMany(
        'api::dwelling.dwelling',
        {
          filters: {
            locale: {
              $eq: 'en',
            },
          },
          populate: ['localizations'],
        }
      )

      const formattedData =
        dwellings?.length > 0
          ? dwellings?.map(item => {
              const alternates =
                item?.localizations?.length > 0
                  ? {
                      languages: {
                        en: `https://workerhomes.pl/en/${item?.slug}`,
                        [item?.localizations?.[0]
                          ?.locale]: `https://workerhomes.pl/de/${item?.localizations?.[0]?.slug}`,
                        [item?.localizations?.[1]
                          ?.locale]: `https://workerhomes.pl/pl/${item?.localizations?.[1]?.slug}`,
                      },
                    }
                  : {}

              return {
                url: `https://workerhomes.pl/en/${item.slug}`,
                lastModified: new Date(item?.updatedAt),
                changeFrequency: 'weekly',
                priority: 0.5,
                alternates,
              }
            })
          : []

      return formattedData
    },
  })
)
