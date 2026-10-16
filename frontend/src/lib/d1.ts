export async function getCategories(db: any) {
  try {
    const { results } = await db.prepare("SELECT * FROM categories").all();
    return results || [];
  } catch (e) {
    console.error("Error fetching categories:", e);
    return [
      { id: "cat_celulares", name: "Celulares", slug: "celulares" },
      { id: "cat_computacion", name: "Computación", slug: "computacion" },
    ];
  }
}

export async function getBestSellers(db: any) {
  try {
    const { results } = await db.prepare("SELECT * FROM products WHERE status = 'published' LIMIT 20").all();
    return results || [];
  } catch (e) {
    console.error("Error fetching best sellers:", e);
    return [
      {
        id: "1",
        title: "Producto de Ejemplo",
        brand: "Marca",
        price: 1000,
        thumbnail: "/placeholder.webp",
        slug: "producto-ejemplo",
      },
    ];
  }
}
