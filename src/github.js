const createCommitStatus = async ({
  client,
  context,
  sha,
  status,
}) => {
  try {
    await client.rest.repos.createCommitStatus({
      ...context.repo,
      sha,
      ...status,
    });
  } catch (error) {
    console.error('Failed to createCommitStatus', { ...status, sha, error });
    throw error;
  }
};

const listComments = async ({
  client,
  context,
  prNumber,
  commentHeader,
}) => {
  try {
    const { data: existingComments } = await client.rest.issues.listComments({
      ...context.repo,
      issue_number: prNumber,
    });

    return existingComments.filter(({ body }) => body.startsWith(commentHeader));
  } catch (error) {
    console.error('Failed to listComments', { error, prNumber });
    throw error;
  }
};

const insertComment = async ({
  client,
  context,
  prNumber,
  body,
}) => {
  try {
    await client.rest.issues.createComment({
      ...context.repo,
      issue_number: prNumber,
      body,
    });
  } catch (error) {
    console.error('Failed to insertComment', { body, error });
    throw error;
  }
};

const updateComment = async ({
  client,
  context,
  body,
  commentId,
}) => {
  try {
    await client.rest.issues.updateComment({
      ...context.repo,
      comment_id: commentId,
      body,
    });
  } catch (error) {
    console.error('Failed to updateComment', { commentId, body, error });
    throw error;
  }
};

const deleteComments = async ({
  client,
  context,
  comments,
}) => {
  try {
    // eslint-disable-next-line no-restricted-syntax
    for (const { id } of comments) {
      // eslint-disable-next-line no-await-in-loop
      await client.rest.issues.deleteComment({
        ...context.repo,
        comment_id: id,
      });
    }
  } catch (error) {
    console.error('Failed to deleteComments', { comments, error });
    throw error;
  }
};

const upsertComment = async ({
  client,
  context,
  prNumber,
  body,
  existingComments,
}) => {
  try {
    const last = existingComments.pop();

    await deleteComments({
      client,
      context,
      comments: existingComments,
    });

    if (last) {
      await updateComment({
        client,
        context,
        body,
        commentId: last.id,
      });
    } else {
      await insertComment({
        client,
        context,
        prNumber,
        body,
      });
    }
  } catch (error) {
    console.error('Failed to upserComment', { prNumber, body, error });
    throw error;
  }
};

const replaceComment = async ({
  client,
  context,
  prNumber,
  body,
  existingComments,
}) => {
  try {
    await deleteComments({
      client,
      context,
      comments: existingComments,
    });

    await insertComment({
      client,
      context,
      prNumber,
      body,
    });
  } catch (error) {
    console.log('Failed to replaceComment', error);
    throw error;
  }
};

module.exports = {
  createCommitStatus,
  listComments,
  insertComment,
  updateComment,
  deleteComments,
  upsertComment,
  replaceComment,
};
