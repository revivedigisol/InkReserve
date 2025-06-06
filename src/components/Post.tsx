import { useEffect, useState, useRef, type JSX } from "react";
import Quill from "quill";
import Tagify from "@yaireo/tagify";
import "quill/dist/quill.snow.css";
import "@yaireo/tagify/dist/tagify.css";
import { marked } from "marked";
import Selection from "./Selection";
import GeneratePost from "./GeneratePost";
import { ClipLoader } from "react-spinners";
export type Category = {
  id: number;
  name: string;
  parent: number;
};

type CategoryMap = Map<number, Category[]>;

const Post = () => {
  const titleInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLDivElement>(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const imageUploadRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [tagify, setTagify] = useState<Tagify | null>(null);
  const [categoryMap, setCategoryMap] = useState<CategoryMap>(new Map());
  const [categoryParentMap, setCategoryParentMap] = useState<Map<number, number>>(new Map());
  const [checkedCategories, setCheckedCategories] = useState<Set<number>>(new Set());
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const quillRef = useRef<Quill | null>(null);
  const [selected, setSelected] = useState("option-one");
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const [submitLoading, setSubmitLoading] = useState(false);
  const GEMINI_API_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";


  // Get url from hostname
  const getBaseUrl = () => {
    const hostname = window.location.hostname;
    const parts = hostname.split(".");
    if (parts.length >= 3) return `${parts[0]}.enle.org`;
    return "enle.org";
  };

  useEffect(() => {
    if (quillRef.current) return;
    quillRef.current = new Quill("#editor", {
      theme: "snow",
      placeholder: "Tell your story...",
      modules: {
        toolbar: [
          [{ header: [1, 2, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["link", "blockquote", "code-block"],
          ["clean"],
        ],
      },
    });

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setSelectedImage(file);
        const label = document.querySelector('label[for="upload"]');
        if (label) {
          label.textContent = `📁 Selected: ${file.name}`;
        }
      }
    };

    imageUploadRef.current?.addEventListener("change", handleImageUpload);

    const loadTagsAndCategories = async () => {
      try {
        const tagRes = await fetch(
          `https://${getBaseUrl()}/wp-json/wp/v2/tags?per_page=100`
        );
        const tags = await tagRes.json();
        const tagifyInstance = new Tagify(tagInputRef.current!, {
          whitelist: tags.map((tag: { name: string }) => tag.name),
          dropdown: {
            enabled: 0,
            maxItems: 10,
            position: "all",
            highlightFirst: true,
          },
        });
        setTagify(tagifyInstance);
      } catch (err) {
        console.error("Failed to load tags:", err);
      }

      const fetchCategories = async () => {
        const catRes = await fetch(
          `https://${getBaseUrl()}/wp-json/wp/v2/categories?per_page=100`
        );
        const categories: Category[] = await catRes.json();

        const map: CategoryMap = new Map();
        const parentMap = new Map<number, number>();

        categories.forEach((cat) => {
          parentMap.set(cat.id, cat.parent);
          if (!map.has(cat.parent)) map.set(cat.parent, []);
          map.get(cat.parent)!.push(cat);
        });
        setCategories(categories);

        setCategoryMap(map);
        setCategoryParentMap(parentMap);
      };

      fetchCategories();
    };

    loadTagsAndCategories();

    return () => {
      imageUploadRef.current?.removeEventListener("change", handleImageUpload);
    };
  }, []);
  const handleCheckboxChange = (id: number, checked: boolean) => {
    const newChecked = new Set(checkedCategories);
    if (checked) {
      // Check all parents
      let parentId = categoryParentMap.get(id);
      while (parentId && parentId !== 0) {
        newChecked.add(parentId);
        parentId = categoryParentMap.get(parentId);
      }
      newChecked.add(id);
    } else {
      // Uncheck all children
      const uncheckChildren = (parentId: number) => {
        const children = categoryMap.get(parentId) || [];
        children.forEach((child) => {
          newChecked.delete(child.id);
          uncheckChildren(child.id);
        });
      };
      newChecked.delete(id);
      uncheckChildren(id);
    }

    setCheckedCategories(newChecked);
  };

  const renderCategories = (parentId = 0, depth = 0): JSX.Element[] => {
    const children = categoryMap.get(parentId) || [];
    return children.map((category) => (
      <div key={category.id} style={{ marginLeft: `${depth * 1}rem` }} className="mb-1">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="category-checkbox"
            checked={checkedCategories.has(category.id)}
            onChange={(e) => handleCheckboxChange(category.id, e.target.checked)}
          />
          {category.name}
        </label>
        {renderCategories(category.id, depth + 1)}
      </div>
    ));
  };


  const uploadFeaturedImage = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${getBaseUrl()}/wp-json/wp/v2/media`, {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(import.meta.env.VITE_AUTH_TOKEN),
        },
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to upload image");
      const data = await response.json();
      return data.id; // Return the media ID
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    }
  };

  const createOrGetTags = async (tagNames: string[]) => {
    const existingTags: number[] = [];
    const newTags: number[] = [];

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
          existingTags.push(tags[0].id);
        } else {
          const createResponse = await fetch(
            `https://${getBaseUrl()}/wp-json/wp/v2/tags`,
            {
              method: "POST",
              headers: {
                Authorization:
                  "Basic " + btoa(import.meta.env.VITE_AUTH_TOKEN),
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ name: tagName }),
            }
          );
          const newTag = await createResponse.json();
          newTags.push(newTag.id);
        }
      } catch (error) {
        console.error(`Error processing tag ${tagName}:`, error);
      }
    }
    const tagIds = [...existingTags, ...newTags];
    setTagIds(tagIds);
    return tagIds;
  };

  const refineWithAI = async (postTitle: string, postContent: string) => {
    try {
      const prompt = `Refine the following blog post title and content. Format the content using markdown with proper headings, lists, and emphasis where appropriate:

          Title: ${postTitle}

          Content: ${postContent}

          Return the response with the following structure: 
          title: [Title of the post]
          body: [The body of the post in markdown format]`;

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get AI refinements");
      }

      const data = await response.json();

      if (!data.candidates || !data.candidates[0]?.content?.parts) {
        throw new Error("Invalid API response structure");
      }

      const refinedText = data.candidates[0].content.parts[0].text;

      const titleIndex = refinedText.indexOf("title:");
      const bodyIndex = refinedText.indexOf("body:");

      if (titleIndex === -1 || bodyIndex === -1) {
        throw new Error("Response format is invalid");
      }

      const refinedTitle = refinedText
        .substring(titleIndex + 6, bodyIndex)
        .trim();
      const refinedBody = refinedText.substring(bodyIndex + 5).trim();

      if (!refinedTitle || !refinedBody) {
        throw new Error("Empty title or body in response");
      }
      // Convert markdown to HTML using marked
      try {
        // Configure marked for safe HTML
        marked.setOptions({
          headerIds: false,
          mangle: false,
          headerPrefix: '',
          breaks: true,
          gfm: true,
          sanitize: true
        });

        // Convert markdown to HTML
        const parsedBody = marked.parse(refinedBody);

        // Clean up any potential script tags or dangerous content
        const cleanedBody = parsedBody
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+=/gi, '');

        return { title: refinedTitle, body: cleanedBody };
      } catch (markdownError) {
        console.error('Markdown parsing error:', markdownError);
        return { title: refinedTitle, body: refinedBody }; // Fallback to raw body if parsing fails
      }
    } catch (error) {
      console.error("AI Refinement Error:", error);
      throw new Error(`Failed to refine content: ${error.message}`);
    }
  };

  const handleSubmit = async () => {
    setSubmitLoading(true);
    try {
      const title = titleInputRef.current!.value;
      const content = quillRef.current?.root.innerHTML || ""; // Use the ref to get Quill content

      const tagNames = tagify ? tagify.value.map((tag: { value: string }) => tag.value) : [];
      const tagIds = await createOrGetTags(tagNames);

      let featuredMediaId: number | null = null;
      if (selectedImage) {
        featuredMediaId = await uploadFeaturedImage(selectedImage);
      }

      const postData = {
        title,
        content,
        status: "publish",
        categories: checkedCategories,
        tags: tagIds,
        ...(featuredMediaId && { featured_media: featuredMediaId }),
      };

      const response = await fetch(`https://${getBaseUrl()}/wp-json/wp/v2/posts`, {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa("revivedigisol@gmail.com:3Lc8pnFkVpUB9hcBhbWN0AFk"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(postData),
      });

      if (!response.ok) {
        throw new Error("Failed to publish post");
      }

      const data = await response.json();

      titleInputRef.current!.value = "";
      quillRef.current?.setText(""); // Use the ref to reset Quill content
      tagify?.removeAllTags();
      setCheckedCategories(new Set());
      const uploadLabel = document.querySelector('label[for="upload"]');
      if (uploadLabel)
        uploadLabel.textContent = "📁 Click to upload featured image";
      setSelectedImage(null);
      if (imageUploadRef.current) imageUploadRef.current.value = "";

      alert("✅ Post published successfully!");
      window.open(data.link, "_blank");
    } catch (error: any) {
      console.error("Error publishing post:", error);
      alert("❌ Failed to publish: " + error.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleReviewAI = async () => {
    setLoadingReview(true);
    try {
      const originalTitle = titleInputRef.current!.value.trim();
      const originalContent = quillRef.current?.root.innerHTML.trim(); // Use the ref to get Quill content

      if (!originalTitle || !originalContent) {
        alert(
          "Please enter both title and content before using AI refinement."
        );
        return;
      }

      const refinements = await refineWithAI(originalTitle, originalContent);

      titleInputRef.current!.value = refinements.title;
      quillRef.current?.setContents([]); // Use the ref to reset Quill content
      quillRef.current?.clipboard.dangerouslyPasteHTML(0, refinements.body); // Use the ref to paste HTML

      alert("✨ Content has been refined by AI!");
    } catch (error: any) {
      console.error("Error during AI refinement:", error);
      alert("❌ Failed to refine content: " + error.message);
    } finally {
      setLoadingReview(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-[#fff8dc] to-[#fef6e4] text-[#1d1d1f] min-h-screen font-sans w-full">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 bg-white p-8 rounded-2xl shadow-xl">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-8">
            InkReserve – Your intelligent assistant for managing drafts✨
          </h1>
          <Selection selected={selected} setSelected={setSelected} />

          {selected === "option-one" && (
            <>
              <div className="relative z-0 w-full mb-8 group">
                <input
                  type="text"
                  id="title"
                  name="title"
                  className="block py-4 px-0 w-full text-2xl font-semibold text-gray-800 bg-transparent border-0 border-b-2 border-gray-300 appearance-none focus:outline-none focus:ring-0 focus:border-[#e63946] peer placeholder-transparent"
                  placeholder="Enter your title"
                  ref={titleInputRef}
                />
                <label
                  htmlFor="title"
                  className="absolute text-gray-500 text-lg duration-300 transform -translate-y-6 scale-75 top-4 -z-10 origin-[0] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-4 peer-focus:scale-75 peer-focus:-translate-y-6"
                >
                  Enter your title
                </label>
              </div>
              <div className="mb-10">
                <label
                  htmlFor="editor"
                  className="block text-gray-500 text-base font-medium mb-2"
                >
                  Tell your story
                </label>
                <div
                  id="editor"
                  className="bg-white border border-gray-300 rounded-md min-h-[200px] p-4"
                ></div>
              </div>
              <div className="mb-10">
                <label
                  htmlFor="upload"
                  className="block border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-500 cursor-pointer hover:bg-gray-50"
                >
                  📁 Click to upload featured image
                </label>
                <input
                  type="file"
                  id="upload"
                  className="hidden"
                  ref={imageUploadRef}
                />
              </div>
            </>
          )}

        </div>

        <div className="bg-white p-8 rounded-2xl shadow-xl flex flex-col gap-6">
          <div>
            <h3 className="text-xl font-semibold mb-3">🗂 Categories</h3>
            <div
              id="categoryList"
              className="flex flex-col gap-2 text-sm text-gray-700"
            >
              {renderCategories()}
            </div>
          </div>
          <div className="relative z-0 w-full group">
            <div className="flex flex-wrap items-center gap-2 p-2 rounded-md">
              <input
                type="text"
                id="tags"
                name="tags"
                className="tag-input flex-1 py-1 px-2 text-base text-gray-800 bg-transparent border-none focus:outline-none placeholder-gray-400"
                placeholder="Add a tag and press enter"
                ref={tagInputRef as any}
              />
            </div>
            <label htmlFor="tags" className="block mt-1 text-sm text-gray-500">
              Add tags (comma separated)
            </label>
          </div>

          <div className="flex flex-wrap gap-4">
            {selected === "option-one" && (
              <>
                <button
                  id="submitPost"
                  className="bg-[#1e90ff] text-white px-6 py-3 rounded-full text-sm shadow hover:bg-[#1c7ed6] transition-all"
                  onClick={handleSubmit}
                >
                  {submitLoading ? <ClipLoader color="#fff" size={20} /> : "🚀 Publish"}
                </button>
                <button
                  id="reviewAI"
                  className="bg-[#fbc414] text-black px-6 py-3 rounded-full text-sm shadow hover:brightness-110 transition-all"
                  onClick={handleReviewAI}
                  disabled={loadingReview}
                >
                  {loadingReview ? <ClipLoader color="#000" size={20} /> : "🤖 Review with AI"}
                </button>
              </>
            )}
            {selected === "option-two" && <GeneratePost tagify={tagify} getBaseUrl={getBaseUrl} checkedCategories={checkedCategories} categories={categories} tagIds={tagIds} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Post;
