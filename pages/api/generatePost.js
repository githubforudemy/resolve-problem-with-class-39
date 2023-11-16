import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0';
import {Configuration, OpenAIApi} from 'openai';
import clientPromise from '../../lib/mongodb';

export default withApiAuthRequired(async function handler(req, res) {
    
  const {user} = await getSession(req, res);
  const client = await clientPromise;
  const db = client.db("AutoBlogger");
  const userProfile = await db.collection("users").findOne({
    auth0Id: user.sub,
  });

  if (!userProfile?.availableTokens) {
    res.status(403);
    return;
  }

  const config = new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(config);

    const {topic, keywords} = req.body;

    if(!topic || !keywords){
      res.status(422);
      return;
    }

    if(topic.length > 100 || keywords.length > 150) {
      res.status(422);
      return;
    }

    const postContentResponse = await openai.createChatCompletion({
      model: "gpt-4-1106-preview", //gpt-3.5-turbo
      temperature: 0.5, //0
      max_tokens: 4000, //he anadido yo esta línea https://github.com/Saf3ty1nnumb3rs/next_ts_blog_standard/blob/main/pages/api/generatePost.ts
      messages: [{
        role: "system",
        content: "You are a blog post generator"
      }, {
        role: "user",
        content: `Write a long and detailed SEO-friendly blog post about ${topic}, that targets the following comma-separated keywords: ${keywords}.
        The response should be formatted in SEO-friendly HTML,
        limited to the following HTML tags: p, h1, h2, h3, h4, h5, h6, li, ol, ul, hr, br, pre, b, strong, i, em, mark, small, del, ins, sub, sup, blockquate, q, abbr, address, cite, bdo.`
        },
       ],
    });

    const postContent = postContentResponse.data.choices[0]?.message?.content || "";

    const titleResponse = await openai.createChatCompletion({
        model: "gpt-4-1106-preview", //gpt-3.5-turbo
        temperature: 0.5, //0
        max_tokens: 4000, //he anadido yo esta línea https://github.com/Saf3ty1nnumb3rs/next_ts_blog_standard/blob/main/pages/api/generatePost.ts
        messages: [{
          role: "system",
          content: "You are a blog post generator"
        }, {
          role: "user",
          content: `Write a long and detailed SEO-friendly blog post about ${topic}, that targets the following comma-separated keywords: ${keywords},
          include only the text content in your response, do not include the html <title></title> tag in your response.
          The response should be formatted in SEO-friendly HTML,
          limited to the following HTML tags: p, h1, h2, h3, h4, h5, h6, li, ol, ul, hr, br, pre, b, strong, i, em, mark, small, del, ins, sub, sup, blockquate, q, abbr, address, cite, bdo.`
          }, {
            role: "assistant",
            content: postContent
          }, {
            role: "user",
            content: "Generate appropriate title tag text for the above blog post and return as plain text; no additional quotation marks"
          },
        ],
    });

    const metaDescriptionResponse = await openai.createChatCompletion({
      model: "gpt-4-1106-preview", //gpt-3.5-turbo
      temperature: 0.5, //0
      max_tokens: 4000, //he anadido yo esta línea https://github.com/Saf3ty1nnumb3rs/next_ts_blog_standard/blob/main/pages/api/generatePost.ts
      messages: [{
        role: "system",
        content: "You are a blog post generator"
      }, {
        role: "user",
        content: `Write a long and detailed SEO-friendly blog post about ${topic}, that targets the following comma-separated keywords: ${keywords},
        include only the text content in your response, do not include the html <meta name="description" content=""> tag in your response.
        The response should be formatted in SEO-friendly HTML,
        limited to the following HTML tags: p, h1, h2, h3, h4, h5, h6, li, ol, ul, hr, br, pre, b, strong, i, em, mark, small, del, ins, sub, sup, blockquate, q, abbr, address, cite, bdo.`
        }, {
          role: "assistant",
          content: postContent
        }, {
          role: "user",
          content: "Generate appropriate title tag text for the above blog post and return as plain text; no additional quotation marks"
         },
       ],
    });

    const title = titleResponse.data.choices[0]?.message?.content || "";
    const metaDescription = metaDescriptionResponse.data.choices[0]?.message?.content || "";

    console.log('POST CONTENT: ', postContent);
    console.log('TITLE: ', title);
    console.log('META DESCRIPTION: ', metaDescription);

    await db.collection("users").updateOne(
      {
      auth0Id: user.sub,
    }, {
      $inc: {
        availableTokens: -1,
      }
    });

    const post = await db.collection("posts").insertOne({
      postContent,
      title,
      metaDescription,
      topic,
      keywords,
      userId: userProfile._id,
      created: new Date(),
    });

    console.log('POST: ', post);

    res.status(200).json({
       postId: post.insertedId,
    });
});

