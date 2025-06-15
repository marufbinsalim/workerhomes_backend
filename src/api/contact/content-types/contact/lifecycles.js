const mailchimp = require("@mailchimp/mailchimp_transactional")(
  process.env.MANDRILL_API_KEY
);
module.exports = {
  async afterCreate(event) {
    const { result } = event;

    console.log("contactDetails", result);

    let message = {
      from_email: "info@workerhomes.pl",
      from_name: "WorkerHomes",
      subject: result.subject,
      text: `
      name: ${result.name},
      email: ${result.email}
      subject: ${result?.subject},
      message: ${result?.message},
      `,
      to: [
        {
          email: "fzudemz90@gmail.com",
          // email: "joya.abn@gmail.com",
          type: "to",
        },
      ],
    };

    async function run() {
      const response = await mailchimp.messages.send({
        message,
      });
      console.log(response);
    }
    run();
  },
};
