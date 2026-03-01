import { get, post, patch, del } from "./httpClient";

export type Subcategory = {
  id: string;
  name: string;
  parent: string;
  icon?: string | null;
  color?: string | null;
  source?: string;
  confidence?: number;
};

export type SubcategoriesByCategory = Record<string, Subcategory[]>;

export async function fetchAllSubcategories(): Promise<SubcategoriesByCategory> {
  const response = await get<{ success: boolean; subcategoriesByCategory?: SubcategoriesByCategory }>(
    "/tasks/subcategories",
  );
  return response.subcategoriesByCategory || {};
}

export async function fetchSubcategoriesForCategory(category: string): Promise<Subcategory[]> {
  const response = await get<{ success: boolean; subcategories?: Subcategory[] }>(
    `/tasks/subcategories?category=${encodeURIComponent(category)}`,
  );
  return response.subcategories || [];
}

export async function createSubcategory(params: {
  name: string;
  category: string;
  icon?: string | null;
  color?: string | null;
}) {
  const response = await post<{ success: boolean; subcategory?: Subcategory }>("/tasks/subcategories", {
    name: params.name,
    category: params.category,
    icon: params.icon || null,
    color: params.color || null,
  });
  return response.subcategory || null;
}

export async function updateSubcategory(
  id: string,
  updates: { name?: string; icon?: string | null; color?: string | null },
) {
  const response = await patch<{ success: boolean; subcategory?: Subcategory }>(`/tasks/subcategories/${id}`, updates);
  return response.subcategory || null;
}

export async function deleteSubcategory(id: string) {
  await del<{ success: boolean }>(`/tasks/subcategories/${id}`);
  return true;
}

export default {
  fetchAllSubcategories,
  fetchSubcategoriesForCategory,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
};
