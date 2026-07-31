import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Beaker, Boxes, IceCreamBowl, PackageOpen, Sparkles } from "lucide-react";
import api from "../../services/api";
import LoadingSkeleton from "../../components/common/LoadingSkeleton";
import Modal from "../../components/common/Modal";
import StatusBadge from "../../components/common/StatusBadge";

function quantityLabel(recipe) {
  return `${Number(recipe.quantity).toLocaleString("vi-VN", { maximumFractionDigits: 3 })} ${recipe.ingredient.unit}`;
}

function RecipeList({ recipes = [], emptyText = "Chưa cấu hình nguyên liệu." }) {
  if (!recipes.length) {
    return <div className="tw-rounded-xl tw-bg-slate-50 tw-p-3 tw-text-xs tw-text-slate-400 dark:tw-bg-slate-800">{emptyText}</div>;
  }
  return (
    <div className="tw-space-y-2">
      {recipes.map((recipe) => (
        <div key={recipe.id} className="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-rounded-xl tw-border tw-border-slate-100 tw-bg-white tw-p-3 dark:tw-border-slate-700 dark:tw-bg-slate-900">
          <div className="tw-min-w-0">
            <strong className="tw-block tw-truncate tw-text-sm">{recipe.ingredient.name}</strong>
            <span className="tw-text-[11px] tw-text-slate-400">{recipe.ingredient.code}{recipe.note ? ` · ${recipe.note}` : ""}</span>
          </div>
          <span className="tw-shrink-0 tw-rounded-lg tw-bg-mint-50 tw-px-2.5 tw-py-1.5 tw-text-xs tw-font-black tw-text-mint-700 dark:tw-bg-mint-900/20 dark:tw-text-mint-300">{quantityLabel(recipe)}</span>
        </div>
      ))}
    </div>
  );
}

export default function ProductRecipeDialog({ open, productId, onClose }) {
  const recipeQuery = useQuery({
    queryKey: ["product-recipe", productId],
    queryFn: () => api.get(`/products/${productId}`).then((response) => response.data.data),
    enabled: open && Boolean(productId),
  });
  const product = recipeQuery.data;
  const summary = useMemo(() => {
    if (!product) return { rows: 0, ingredients: 0 };
    const allRecipes = [
      ...(product.recipes || []),
      ...product.variants.flatMap((variant) => variant.recipes || []),
      ...(product.flavorRecipes || []).flatMap((flavor) => flavor.recipes || []),
      ...(product.toppingRecipes || []).flatMap((topping) => topping.recipes || []),
    ];
    return {
      rows: allRecipes.length,
      ingredients: new Set(allRecipes.map((recipe) => recipe.ingredientId)).size,
    };
  }, [product]);

  return (
    <Modal open={open} onClose={onClose} title={product ? `Công thức · ${product.name}` : "Công thức sản phẩm"} maxWidth="lg">
      {recipeQuery.isLoading ? <LoadingSkeleton rows={8} cards /> : product && (
        <div className="tw-space-y-6 tw-py-2">
          <div className="tw-flex tw-flex-col tw-gap-4 tw-rounded-2xl tw-border tw-border-mint-200 tw-bg-gradient-to-r tw-from-mint-50 tw-to-white tw-p-4 sm:tw-flex-row sm:tw-items-center dark:tw-border-mint-800 dark:tw-from-mint-900/20 dark:tw-to-slate-900">
            <div className="tw-flex tw-h-16 tw-w-16 tw-shrink-0 tw-items-center tw-justify-center tw-overflow-hidden tw-rounded-2xl tw-bg-white tw-text-3xl tw-shadow-sm dark:tw-bg-slate-800">
              {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="tw-h-full tw-w-full tw-object-cover" /> : "🍨"}
            </div>
            <div className="tw-min-w-0 tw-flex-1">
              <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
                <h3 className="tw-m-0 tw-text-xl tw-font-black">{product.name}</h3>
                <StatusBadge status={product.status} label={{ ACTIVE: "Đang bán", INACTIVE: "Ngừng bán", OUT_OF_STOCK: "Hết hàng" }[product.status]} />
              </div>
              <p className="tw-mb-0 tw-mt-1 tw-text-sm tw-text-slate-500">{product.code} · {product.category.name}</p>
              <p className="tw-mb-0 tw-mt-2 tw-text-xs tw-text-slate-400">Các định lượng dưới đây là dữ liệu hệ thống dùng để trừ kho khi đơn được hoàn thành.</p>
            </div>
          </div>

          <div className="tw-grid tw-gap-3 sm:tw-grid-cols-3">
            <div className="tw-rounded-2xl tw-bg-slate-50 tw-p-4 dark:tw-bg-slate-800"><span className="tw-text-xs tw-text-slate-400">Nguyên liệu liên quan</span><strong className="tw-mt-1 tw-block tw-text-xl">{summary.ingredients}</strong></div>
            <div className="tw-rounded-2xl tw-bg-lavender-50 tw-p-4 dark:tw-bg-lavender-500/10"><span className="tw-text-xs tw-text-slate-400">Dòng định lượng</span><strong className="tw-mt-1 tw-block tw-text-xl">{summary.rows}</strong></div>
            <div className="tw-rounded-2xl tw-bg-mint-50 tw-p-4 dark:tw-bg-mint-900/20"><span className="tw-text-xs tw-text-slate-400">Biến thể</span><strong className="tw-mt-1 tw-block tw-text-xl">{product.variants.length}</strong></div>
          </div>

          <section>
            <div className="tw-mb-3 tw-flex tw-items-center tw-gap-2"><Beaker size={18} className="tw-text-mint-600" /><h4 className="tw-m-0 tw-text-base tw-font-black">Nguyên liệu chung của sản phẩm</h4></div>
            <RecipeList recipes={product.recipes} emptyText="Sản phẩm này không có định lượng chung; nguyên liệu được xác định theo từng biến thể và lựa chọn của khách." />
          </section>

          <section>
            <div className="tw-mb-3 tw-flex tw-items-center tw-gap-2"><PackageOpen size={18} className="tw-text-lavender-500" /><h4 className="tw-m-0 tw-text-base tw-font-black">Công thức theo biến thể</h4></div>
            <div className="tw-grid tw-gap-3 lg:tw-grid-cols-2">
              {product.variants.map((variant) => (
                <div key={variant.id} className="tw-rounded-2xl tw-border tw-border-slate-200 tw-p-4 dark:tw-border-slate-700">
                  <div className="tw-mb-3 tw-flex tw-items-start tw-justify-between tw-gap-3">
                    <div><strong className="tw-block">{variant.name}</strong><span className="tw-text-xs tw-text-slate-400">{variant.sku}{variant.cupType ? ` · ${variant.cupType}` : ""}</span></div>
                    <span className="tw-rounded-lg tw-bg-lavender-50 tw-px-2.5 tw-py-1 tw-text-xs tw-font-bold tw-text-lavender-600 dark:tw-bg-lavender-500/10">{variant.scoopCount} viên</span>
                  </div>
                  <RecipeList recipes={variant.recipes} emptyText="Biến thể chưa có nguyên liệu cố định." />
                </div>
              ))}
            </div>
          </section>

          <details className="tw-rounded-2xl tw-border tw-border-slate-200 tw-p-4 open:tw-bg-slate-50 dark:tw-border-slate-700 dark:open:tw-bg-slate-800/50">
            <summary className="tw-flex tw-cursor-pointer tw-list-none tw-items-center tw-gap-2 tw-font-black"><IceCreamBowl size={18} className="tw-text-blush-500" />Định lượng theo hương vị khách chọn <span className="tw-ml-auto tw-text-xs tw-font-medium tw-text-slate-400">{product.flavorRecipes.length} hương vị</span></summary>
            <p className="tw-mb-3 tw-mt-2 tw-text-xs tw-text-slate-400">Định lượng áp dụng cho mỗi viên kem; số lần nhân theo số viên của biến thể.</p>
            <div className="tw-grid tw-gap-3 lg:tw-grid-cols-2">
              {product.flavorRecipes.map((flavor) => (
                <div key={flavor.id} className="tw-rounded-2xl tw-bg-white tw-p-3 dark:tw-bg-slate-900">
                  <div className="tw-mb-2 tw-flex tw-items-center tw-gap-2"><span className="tw-h-3 tw-w-3 tw-rounded-full" style={{ backgroundColor: flavor.color }} /><strong className="tw-text-sm">{flavor.name}</strong></div>
                  <RecipeList recipes={flavor.recipes} />
                </div>
              ))}
            </div>
          </details>

          <details className="tw-rounded-2xl tw-border tw-border-slate-200 tw-p-4 open:tw-bg-slate-50 dark:tw-border-slate-700 dark:open:tw-bg-slate-800/50">
            <summary className="tw-flex tw-cursor-pointer tw-list-none tw-items-center tw-gap-2 tw-font-black"><Sparkles size={18} className="tw-text-amber-500" />Định lượng topping mua thêm <span className="tw-ml-auto tw-text-xs tw-font-medium tw-text-slate-400">{product.toppingRecipes.length} topping</span></summary>
            <p className="tw-mb-3 tw-mt-2 tw-text-xs tw-text-slate-400">Mỗi topping được cộng vào công thức khi khách chọn trong POS.</p>
            <div className="tw-grid tw-gap-3 lg:tw-grid-cols-2">
              {product.toppingRecipes.map((topping) => (
                <div key={topping.id} className="tw-rounded-2xl tw-bg-white tw-p-3 dark:tw-bg-slate-900">
                  <div className="tw-mb-2 tw-flex tw-items-center tw-gap-2"><Boxes size={17} className="tw-text-amber-500" /><strong className="tw-text-sm">{topping.name}</strong></div>
                  <RecipeList recipes={topping.recipes} />
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </Modal>
  );
}
