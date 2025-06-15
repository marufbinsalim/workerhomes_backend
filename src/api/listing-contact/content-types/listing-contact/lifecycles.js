const mailchimp = require("@mailchimp/mailchimp_transactional")(
  process.env.MANDRILL_API_KEY
);
module.exports = {
  async afterCreate(event) {
    const { result } = event;
    const contactDetails = await strapi.entityService.findOne(
      "api::listing-contact.listing-contact",
      result.id,
      {
        populate: {
          dwelling: {
            populate: {
              subscription: {
                populate: {
                  user: true,
                },
              },
              owner: true,
            },
          },
        },
      }
    );

    console.log("contactDetails", contactDetails);

    let message = {
      from_email: "info@workerhomes.pl",
      from_name: "WorkerHomes - DO NOT REPLY",
      subject: `new message in ${contactDetails.dwelling.title}`,
      text: `
      name / company: ${contactDetails.name_or_company},
      email: ${contactDetails.email}
      phone: ${contactDetails?.phone},
      check in: ${contactDetails?.check_in},
      check out: ${contactDetails?.check_out},
      guests: ${contactDetails?.guests},
      additional information: ${contactDetails?.additional_information},

      Dear Owner! Please do not reply to this email address. if you want to contact with the person who sent you this email, please send an email to ${contactDetails.email}.
      `,
    };

    if (contactDetails.dwelling.owner) {
      message.to = [
        {
          email: contactDetails.dwelling.owner.email,
          // email: "joya.abn@gmail.com",
          type: "to",
        },
      ];
    } else {
      message.to = [
        {
          email: contactDetails.dwelling.subscription.user.email,
          // email: "ahmadjoya.af@gmail.com",
          type: "to",
        },
      ];
    }

    async function run() {
      const response = await mailchimp.messages.send({
        message,
      });
      console.log(response);
    }
    run();
  },
};
