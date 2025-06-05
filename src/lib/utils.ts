import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const fetchCategoriesBasedOnSubdomain = async (subdomain: string) => {
  let categories: any[] = []

  switch (subdomain) {
    case "train":
    case "scale":
    case "innovate":
    case "build":
    case "finance":
    case "counsel":
      const response = await fetch(`https://${subdomain}.enle.org/wp-json/wp/v2/categories?per_page=100`)
      categories = await response.json()
      break;

    default:
      const categoriesResponse = await fetch(`https://enle.org/wp-json/wp/v2/categories?per_page=100`)
      categories = await categoriesResponse.json()
      break;
  }

  return categories
}
export const fetchTagsBasedOnSubdomain = async (subdomain: string) => {
  let tags: any[] = []

  switch (subdomain) {
    case "train":
    case "scale":
    case "innovate":
    case "build":
    case "finance":
    case "counsel":
      const response = await fetch(`https://${subdomain}.enle.org/wp-json/wp/v2/tags?per_page=100`)
      tags = await response.json()
      break;

    default:
      const tagsResponse = await fetch(`https://enle.org/wp-json/wp/v2/tags?per_page=100`)
      tags = await tagsResponse.json()
      break;
  }

  return tags
}
