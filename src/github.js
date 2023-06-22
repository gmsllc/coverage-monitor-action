const createCommitStatus = ({
  client,
  context,
  sha,
  status,
}) => {
  client.rest.repos.createCommitStatus({
    ...context.repo,
    sha,
    ...status,
  });
};

const listComments = async ({
  client,
  context,
  prNumber,
  commentHeader,
}) => {
  const { data: existingComments } = await client.rest.issues.listComments({
    ...context.repo,
    issue_number: prNumber,
  });

  return existingComments.filter(({ body }) => body.startsWith(commentHeader));
};

const insertComment = ({
  client,
  context,
  prNumber,
  body,
}) => {
  client.rest.issues.createComment({
    ...context.repo,
    issue_number: prNumber,
    body,
  });
};

const updateComment = ({
  client,
  context,
  body,
  commentId,
}) => {
  client.rest.issues.updateComment({
    ...context.repo,
    comment_id: commentId,
    body,
  });
};

const deleteComments = ({
  client,
  context,
  comments,
}) => {
  comments.forEach(({ id }) => {
    client.rest.issues.deleteComment({
      ...context.repo,
      comment_id: id,
    });
  });
};

const upsertComment = ({
  client,
  context,
  prNumber,
  body,
  existingComments,
}) => {
  const last = existingComments.pop();

  deleteComments({
    client,
    context,
    comments: existingComments,
  });

  if (last) {
    updateComment({
      client,
      context,
      body,
      commentId: last.id,
    });
  } else {
    insertComment({
      client,
      context,
      prNumber,
      body,
    });
  }
};

const replaceComment = ({
  client,
  context,
  prNumber,
  body,
  existingComments,
}) => {
  deleteComments({
    client,
    context,
    comments: existingComments,
  });

  insertComment({
    client,
    context,
    prNumber,
    body,
  });
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
