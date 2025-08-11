import type { CollectionEntry } from "astro:content";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { getCategoryUrl, getTagUrl } from "@utils/url-utils.ts";
import { getBlogPosts, getCategories, getTags, type BlogPost, type Category as MicroCMSCategory, type Tag as MicroCMSTag } from "@/lib/microcms";

// microCMSの記事をAstroのCollectionEntry形式に変換
function convertBlogPostToCollectionEntry(post: BlogPost): CollectionEntry<"posts"> {
  return {
    id: post.id,
    slug: post.id,
    body: post.content,
    collection: "posts",
    data: {
      title: post.title,
      published: new Date(post.publishedAt),
      updated: new Date(post.updatedAt),
      description: post.description || "",
      image: post.image?.url || "",
      tags: post.tags?.map(tag => tag.name) || [],
      category: post.category?.name || null,
      draft: post.draft || false,
      lang: "",
      prevTitle: "",
      prevSlug: "",
      nextTitle: "",
      nextSlug: "",
    },
    render: async () => ({
      Content: () => null,
      headings: [],
      remarkPluginFrontmatter: {
        excerpt: post.description || "",
        words: post.content.length,
        minutes: Math.max(1, Math.round(post.content.length / 200)),
      },
    }),
  } as CollectionEntry<"posts">;
}

// ソート済みの記事一覧を取得
export async function getSortedPosts(): Promise<CollectionEntry<"posts">[]> {
  const response = await getBlogPosts({
    orders: '-publishedAt',
    filters: import.meta.env.PROD ? 'draft[equals]false' : undefined,
  });

  const sorted = response.contents.map(convertBlogPostToCollectionEntry);

  // 前後の記事情報を設定
  for (let i = 1; i < sorted.length; i++) {
    sorted[i].data.nextSlug = sorted[i - 1].slug;
    sorted[i].data.nextTitle = sorted[i - 1].data.title;
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    sorted[i].data.prevSlug = sorted[i + 1].slug;
    sorted[i].data.prevTitle = sorted[i + 1].data.title;
  }

  return sorted;
}

export type PostForList = {
  slug: string;
  data: CollectionEntry<"posts">["data"];
};

export async function getSortedPostsList(): Promise<PostForList[]> {
  const sortedFullPosts = await getSortedPosts();

  const sortedPostsList = sortedFullPosts.map((post) => ({
    slug: post.slug,
    data: post.data,
  }));

  return sortedPostsList;
}

export type Tag = {
  name: string;
  count: number;
};

export async function getTagList(): Promise<Tag[]> {
  const [tagsResponse, postsResponse] = await Promise.all([
    getTags(),
    getBlogPosts({ limit: 1000 }),
  ]);

  const countMap: { [key: string]: number } = {};
  
  // 各記事のタグをカウント
  postsResponse.contents.forEach((post: BlogPost) => {
    if (post.tags) {
      post.tags.forEach((tag: MicroCMSTag) => {
        if (!countMap[tag.name]) countMap[tag.name] = 0;
        countMap[tag.name]++;
      });
    }
  });

  // タグをソート
  const keys: string[] = Object.keys(countMap).sort((a, b) => {
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });

  return keys.map((key) => ({ name: key, count: countMap[key] }));
}

export type Category = {
  name: string;
  count: number;
  url: string;
};

export async function getCategoryList(): Promise<Category[]> {
  const [categoriesResponse, postsResponse] = await Promise.all([
    getCategories(),
    getBlogPosts({ limit: 1000 }),
  ]);

  const count: { [key: string]: number } = {};
  
  // 各記事のカテゴリをカウント
  postsResponse.contents.forEach((post: BlogPost) => {
    if (!post.category) {
      const ucKey = i18n(I18nKey.uncategorized);
      count[ucKey] = count[ucKey] ? count[ucKey] + 1 : 1;
      return;
    }

    const categoryName = post.category.name.trim();
    count[categoryName] = count[categoryName] ? count[categoryName] + 1 : 1;
  });

  const lst = Object.keys(count).sort((a, b) => {
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });

  const ret: Category[] = [];
  for (const c of lst) {
    ret.push({
      name: c,
      count: count[c],
      url: getCategoryUrl(c),
    });
  }
  return ret;
}

// 特定の記事を取得
export async function getPostBySlug(slug: string): Promise<CollectionEntry<"posts"> | null> {
  try {
    const post = await getBlogPosts({
      filters: `id[equals]${slug}`,
      limit: 1,
    });
    
    if (post.contents.length === 0) {
      return null;
    }
    
    return convertBlogPostToCollectionEntry(post.contents[0]);
  } catch (error) {
    console.error('Error fetching post:', error);
    return null;
  }
}