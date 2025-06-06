import { useState } from 'react'
import { Button } from './ui/button'
import type { Category } from './Post';
import { ClipLoader } from 'react-spinners';

const createOrGetTags = async (tagNames: string[], getBaseUrl: any) => {
  const existingTags: {id: number, name: string}[] = [];
  const newTags: {id: number, name: string}[] = [];

  for (const tagName of tagNames) {
    try {
      const response = await fetch(
        `https://${getBaseUrl()}/wp-json/wp/v2/tags?search=${encodeURIComponent(
          tagName
        )}`,
        {
          headers: {
            Authorization:
              "Basic " + btoa(import.meta.env.VITE_AUTH_TOKEN),
          },
        }
      );
      const tags = await response.json();

      if (tags.length > 0) {
        existingTags.push({id: tags[0].id, name: tags[0].name});
      } else {
        const createResponse = await fetch(
          `https://${getBaseUrl()}/wp-json/wp/v2/tags`,
          {
            method: "POST",
            headers: {
              Authorization:
                "Basic " + btoa("revivedigisol@gmail.com:3Lc8pnFkVpUB9hcBhbWN0AFk"),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ name: tagName }),
          }
        );
        const newTag = await createResponse.json();
        newTags.push({"id": newTag.id, "name": newTag.name});
      }
    } catch (error) {
      console.error(`Error processing tag ${tagName}:`, error);
    }
  }

  return [...existingTags, ...newTags];
};

const GeneratePost = ({ tagify, getBaseUrl, checkedCategories, categories, tagIds}: { tagify: any, getBaseUrl: () => string, checkedCategories: Set<number>, categories: Category[], tagIds: number[] }) => {
  const [loading, setLoading] = useState(false);
  const generatePostWithAI = async () => {
    try {
      setLoading(true);
      const selectedCategories = Array.from(checkedCategories).flatMap((selectedId) => {
        const category = categories.find((cat) => cat.id === selectedId);
        // Only proceed if it's a top-level category
        if (!category || category.parent) return [];
        const allSubcategories = categories.filter((cat) => cat.parent == selectedId)
          .map((child) => ({
            id: child.id,
            name: child.name,
          }));
        const subcategories = allSubcategories.filter((cat) => checkedCategories.has(cat.id));
        return [{
          id: category.id,
          name: category.name,
          subcategories,
        }];
      });
      const tagNames = tagify ? tagify.value.map((tag: { value: string }) => tag.value) : [];
      const tags = await createOrGetTags(tagNames, getBaseUrl);
      const auth = btoa("revivedigisol@gmail.com:3Lc8pnFkVpUB9hcBhbWN0AFk");
      const response = await fetch(`https://train.enle.org/wp-json/ai/v1/generate-ai-posts`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          categories: selectedCategories,
          tags,
        }),
      });
      const data = await response.json();
      console.log(data);

      if (Array.isArray(data.posts)) {
        for (const post of data.posts) {
          const postData = {
            title: post.post_title,
            content: post.post_content,
            status: "pending",
            categories: checkedCategories,
            tags: tagIds,
          };

          const response = await fetch(`https://${getBaseUrl()}/wp-json/wp/v2/posts`, {
            method: "POST",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(postData),
          });

        }

        alert("✅ Post generated successfully!");
      } else {
        alert("❌ No posts generated");
      }

    } catch (error) {
      console.error("Error generating post with AI:", error);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="flex justify-center">
      <Button onClick={() => { generatePostWithAI() }} className='cursor-pointer' disabled={loading}>{loading ? <ClipLoader color="#fff" size={20} /> : "Generate Post with AI"}</Button>
    </div>
  )
}

export default GeneratePost