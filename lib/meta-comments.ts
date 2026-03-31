export const META_COMMENTS_FILENAME = "meta-comments.json";
export const META_COMMENT_THEMES_FILENAME = "meta-comment-themes.json";

export type MetaCommentAuthor = {
  id?: string;
  name?: string;
};

export type MetaStoredComment = {
  adId?: string;
  postId: string;
  commentId: string;
  text: string;
  createdTime?: string;
  from?: MetaCommentAuthor;
  likeCount?: number;
};

export type MetaCommentsData = {
  syncedAt: string;
  adIdToPostId: Record<string, string>;
  comments: MetaStoredComment[];
};

export type MetaCommentThemesData = {
  generatedAt: string;
  scope: {
    adId?: string;
    postId?: string;
  };
  summary: string;
};

