import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Beaker, Boxes, Edit3, IceCreamBowl, PackageOpen, Plus, Sparkles, Trash2 } from "lucide-react";
import { IconButton } from "@mui/material";
import { toast } from "react-toastify";
import api, { apiMessage } from "../../services/api";
import Button from "../../components/common/Button";
import EmptyState from "../../components/common/EmptyState";
import Input from "../../components/common/Input";
import LoadingSkeleton from "../../components/common/LoadingSkeleton";
import Modal from "../../components/common/Modal";
import Select from "../../components/common/Select";
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

function editableLine(recipe = {}) {
  return {
    clientId: recipe.id || `${Date.now()}-${Math.random()}`,
    ingredientId: recipe.ingredientId || "",
    quantity: recipe.quantity ?? 1,
    note: recipe.note || "",
  };
}

function RecipeEditor({ recipes, ingredients, onChange, emptyText }) {
  const updateLine = (clientId, key, value) => {
    onChange(recipes.map((recipe) => recipe.clientId === clientId ? { ...recipe, [key]: value } : recipe));
  };
  const addLine = () => {
    const available = ingredients.find((ingredient) => !recipes.some((recipe) => recipe.ingredientId === ingredient.id));
    if (!available) return toast.info("Không còn nguyên liệu nào để thêm");
    onChange([...recipes, editableLine({ ingredientId: available.id, quantity: 1 })]);
  };
  return (
    <div className="tw-space-y-3">
      {!recipes.length && <div className="tw-rounded-xl tw-border tw-border-dashed tw-border-slate-200 tw-p-4 tw-text-center tw-text-xs tw-text-slate-400 dark:tw-border-slate-700">{emptyText}</div>}
      {recipes.map((recipe) => {
        const selectedIngredient = ingredients.find((ingredient) => ingredient.id === recipe.ingredientId);
        const options = ingredients
          .filter((ingredient) => ingredient.id === recipe.ingredientId || !recipes.some((item) => item.ingredientId === ingredient.id))
          .map((ingredient) => ({
            value: ingredient.id,
            label: `${ingredient.name} (${ingredient.code})${ingredient.isActive ? "" : " · Ngừng dùng"}`,
          }));
        return (
          <div key={recipe.clientId} className="tw-grid tw-gap-3 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-3 sm:tw-grid-cols-[minmax(210px,1.4fr)_130px_minmax(180px,1fr)_44px] sm:tw-items-center dark:tw-border-slate-700 dark:tw-bg-slate-900">
            <Select label="Nguyên liệu" value={recipe.ingredientId} onChange={(event) => updateLine(recipe.clientId, "ingredientId", event.target.value)} options={options} />
            <Input label={`Số lượng${selectedIngredient ? ` (${selectedIngredient.unit})` : ""}`} type="number" inputProps={{ min: 0.001, step: 0.001 }} value={recipe.quantity} onChange={(event) => updateLine(recipe.clientId, "quantity", event.target.value)} />
            <Input label="Ghi chú" value={recipe.note} onChange={(event) => updateLine(recipe.clientId, "note", event.target.value)} />
            <IconButton color="error" onClick={() => onChange(recipes.filter((item) => item.clientId !== recipe.clientId))} aria-label="Xóa nguyên liệu"><Trash2 size={17} /></IconButton>
          </div>
        );
      })}
      <Button variant="outlined" size="small" startIcon={<Plus size={16} />} onClick={addLine}>Thêm nguyên liệu</Button>
    </div>
  );
}

function recipeDraft(product) {
  return {
    productRecipes: product.recipes.map(editableLine),
    variants: product.variants.map((variant) => ({
      variantId: variant.id,
      recipes: variant.recipes.map(editableLine),
    })),
  };
}

export default function ProductRecipeDialog({ open, productId, canManage, onClose }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const recipeQuery = useQuery({
    queryKey: ["product-recipe", productId],
    queryFn: () => api.get(`/products/${productId}`).then((response) => response.data.data),
    enabled: open && Boolean(productId),
  });
  const metaQuery = useQuery({
    queryKey: ["product-recipe-meta"],
    queryFn: () => api.get("/products/recipes/meta").then((response) => response.data.data),
    enabled: open && canManage,
  });
  const product = recipeQuery.data;
  const ingredients = metaQuery.data?.ingredients || [];
  const saveMutation = useMutation({
    mutationFn: (payload) => api.put(`/products/${productId}/recipes`, payload),
    onSuccess: () => {
      toast.success("Đã cập nhật công thức sản phẩm");
      setEditing(false);
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["product-recipe", productId] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
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

  const beginEditing = () => {
    setDraft(recipeDraft(product));
    setEditing(true);
  };
  const cancelEditing = () => {
    setEditing(false);
    setDraft(null);
  };
  const handleClose = () => {
    cancelEditing();
    onClose();
  };
  const updateVariantRecipes = (variantId, recipes) => {
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((variant) => variant.variantId === variantId ? { ...variant, recipes } : variant),
    }));
  };
  const saveRecipe = () => {
    const allLines = [draft.productRecipes, ...draft.variants.map((variant) => variant.recipes)].flat();
    if (allLines.some((line) => !line.ingredientId || Number(line.quantity) <= 0)) {
      return toast.error("Vui lòng chọn nguyên liệu và nhập định lượng lớn hơn 0");
    }
    saveMutation.mutate({
      productRecipes: draft.productRecipes.map(({ ingredientId, quantity, note }) => ({ ingredientId, quantity: Number(quantity), note: note || null })),
      variants: draft.variants.map((variant) => ({
        variantId: variant.variantId,
        recipes: variant.recipes.map(({ ingredientId, quantity, note }) => ({ ingredientId, quantity: Number(quantity), note: note || null })),
      })),
    });
  };

  const actions = product && canManage ? (
    editing ? (
      <>
        <Button variant="text" color="inherit" onClick={cancelEditing}>Hủy chỉnh sửa</Button>
        <Button loading={saveMutation.isPending} disabled={metaQuery.isLoading} onClick={saveRecipe}>Lưu công thức</Button>
      </>
    ) : <Button startIcon={<Edit3 size={17} />} onClick={beginEditing}>Chỉnh sửa công thức</Button>
  ) : null;

  return (
    <Modal open={open} onClose={handleClose} title={product ? `Công thức · ${product.name}` : "Công thức sản phẩm"} maxWidth="lg" actions={actions}>
      {recipeQuery.isLoading ? <LoadingSkeleton rows={8} cards /> : recipeQuery.isError ? (
        <EmptyState title="Không tải được công thức" description={apiMessage(recipeQuery.error)} action={<Button onClick={() => recipeQuery.refetch()}>Thử lại</Button>} />
      ) : product && (
        <div className="tw-space-y-6 tw-py-2">
          <div className="tw-flex tw-flex-col tw-gap-4 tw-rounded-2xl tw-border tw-border-mint-200 tw-bg-gradient-to-r tw-from-mint-50 tw-to-white tw-p-4 sm:tw-flex-row sm:tw-items-center dark:tw-border-mint-800 dark:tw-from-mint-900/20 dark:tw-to-slate-900">
            <div className="tw-flex tw-h-16 tw-w-16 tw-shrink-0 tw-items-center tw-justify-center tw-overflow-hidden tw-rounded-2xl tw-bg-white tw-text-3xl tw-shadow-sm dark:tw-bg-slate-800">
              {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="tw-h-full tw-w-full tw-object-cover" /> : "🍨"}
            </div>
            <div className="tw-min-w-0 tw-flex-1">
              <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2"><h3 className="tw-m-0 tw-text-xl tw-font-black">{product.name}</h3><StatusBadge status={product.status} label={{ ACTIVE: "Đang bán", INACTIVE: "Ngừng bán", OUT_OF_STOCK: "Hết hàng" }[product.status]} /></div>
              <p className="tw-mb-0 tw-mt-1 tw-text-sm tw-text-slate-500">{product.code} · {product.category.name}</p>
              <p className="tw-mb-0 tw-mt-2 tw-text-xs tw-text-slate-400">Các định lượng dưới đây là dữ liệu hệ thống dùng để trừ kho khi đơn được hoàn thành.</p>
            </div>
          </div>

          {!editing && (
            <div className="tw-grid tw-gap-3 sm:tw-grid-cols-3">
              <div className="tw-rounded-2xl tw-bg-slate-50 tw-p-4 dark:tw-bg-slate-800"><span className="tw-text-xs tw-text-slate-400">Nguyên liệu liên quan</span><strong className="tw-mt-1 tw-block tw-text-xl">{summary.ingredients}</strong></div>
              <div className="tw-rounded-2xl tw-bg-lavender-50 tw-p-4 dark:tw-bg-lavender-500/10"><span className="tw-text-xs tw-text-slate-400">Dòng định lượng</span><strong className="tw-mt-1 tw-block tw-text-xl">{summary.rows}</strong></div>
              <div className="tw-rounded-2xl tw-bg-mint-50 tw-p-4 dark:tw-bg-mint-900/20"><span className="tw-text-xs tw-text-slate-400">Biến thể</span><strong className="tw-mt-1 tw-block tw-text-xl">{product.variants.length}</strong></div>
            </div>
          )}

          {editing && metaQuery.isLoading ? <LoadingSkeleton rows={5} /> : editing && metaQuery.isError ? (
            <EmptyState title="Không tải được nguyên liệu" description={apiMessage(metaQuery.error)} action={<Button onClick={() => metaQuery.refetch()}>Thử lại</Button>} />
          ) : (
            <>
              <section>
                <div className="tw-mb-3 tw-flex tw-items-center tw-gap-2"><Beaker size={18} className="tw-text-mint-600" /><h4 className="tw-m-0 tw-text-base tw-font-black">Nguyên liệu chung của sản phẩm</h4></div>
                {editing ? <RecipeEditor recipes={draft.productRecipes} ingredients={ingredients} onChange={(recipes) => setDraft((current) => ({ ...current, productRecipes: recipes }))} emptyText="Chưa có nguyên liệu chung." /> : <RecipeList recipes={product.recipes} emptyText="Sản phẩm này không có định lượng chung; nguyên liệu được xác định theo từng biến thể và lựa chọn của khách." />}
              </section>

              <section>
                <div className="tw-mb-3 tw-flex tw-items-center tw-gap-2"><PackageOpen size={18} className="tw-text-lavender-500" /><h4 className="tw-m-0 tw-text-base tw-font-black">Công thức theo biến thể</h4></div>
                <div className="tw-grid tw-gap-3 lg:tw-grid-cols-2">
                  {product.variants.map((variant) => {
                    const variantDraft = draft?.variants.find((item) => item.variantId === variant.id);
                    return (
                      <div key={variant.id} className={`tw-rounded-2xl tw-border tw-border-slate-200 tw-p-4 dark:tw-border-slate-700 ${editing ? "lg:tw-col-span-2" : ""}`}>
                        <div className="tw-mb-3 tw-flex tw-items-start tw-justify-between tw-gap-3"><div><strong className="tw-block">{variant.name}</strong><span className="tw-text-xs tw-text-slate-400">{variant.sku}{variant.cupType ? ` · ${variant.cupType}` : ""}</span></div><span className="tw-rounded-lg tw-bg-lavender-50 tw-px-2.5 tw-py-1 tw-text-xs tw-font-bold tw-text-lavender-600 dark:tw-bg-lavender-500/10">{variant.scoopCount} viên</span></div>
                        {editing ? <RecipeEditor recipes={variantDraft.recipes} ingredients={ingredients} onChange={(recipes) => updateVariantRecipes(variant.id, recipes)} emptyText="Biến thể chưa có nguyên liệu cố định." /> : <RecipeList recipes={variant.recipes} emptyText="Biến thể chưa có nguyên liệu cố định." />}
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {!editing && (
            <>
              <details className="tw-rounded-2xl tw-border tw-border-slate-200 tw-p-4 open:tw-bg-slate-50 dark:tw-border-slate-700 dark:open:tw-bg-slate-800/50">
                <summary className="tw-flex tw-cursor-pointer tw-list-none tw-items-center tw-gap-2 tw-font-black"><IceCreamBowl size={18} className="tw-text-blush-500" />Định lượng theo hương vị khách chọn <span className="tw-ml-auto tw-text-xs tw-font-medium tw-text-slate-400">{product.flavorRecipes.length} hương vị</span></summary>
                <p className="tw-mb-3 tw-mt-2 tw-text-xs tw-text-slate-400">Định lượng áp dụng cho mỗi viên kem; số lần nhân theo số viên của biến thể. Chỉnh sửa tại phần quản lý Hương vị.</p>
                <div className="tw-grid tw-gap-3 lg:tw-grid-cols-2">{product.flavorRecipes.map((flavor) => <div key={flavor.id} className="tw-rounded-2xl tw-bg-white tw-p-3 dark:tw-bg-slate-900"><div className="tw-mb-2 tw-flex tw-items-center tw-gap-2"><span className="tw-h-3 tw-w-3 tw-rounded-full" style={{ backgroundColor: flavor.color }} /><strong className="tw-text-sm">{flavor.name}</strong></div><RecipeList recipes={flavor.recipes} /></div>)}</div>
              </details>
              <details className="tw-rounded-2xl tw-border tw-border-slate-200 tw-p-4 open:tw-bg-slate-50 dark:tw-border-slate-700 dark:open:tw-bg-slate-800/50">
                <summary className="tw-flex tw-cursor-pointer tw-list-none tw-items-center tw-gap-2 tw-font-black"><Sparkles size={18} className="tw-text-amber-500" />Định lượng topping mua thêm <span className="tw-ml-auto tw-text-xs tw-font-medium tw-text-slate-400">{product.toppingRecipes.length} topping</span></summary>
                <p className="tw-mb-3 tw-mt-2 tw-text-xs tw-text-slate-400">Mỗi topping được cộng vào công thức khi khách chọn trong POS. Chỉnh sửa tại phần quản lý Topping.</p>
                <div className="tw-grid tw-gap-3 lg:tw-grid-cols-2">{product.toppingRecipes.map((topping) => <div key={topping.id} className="tw-rounded-2xl tw-bg-white tw-p-3 dark:tw-bg-slate-900"><div className="tw-mb-2 tw-flex tw-items-center tw-gap-2"><Boxes size={17} className="tw-text-amber-500" /><strong className="tw-text-sm">{topping.name}</strong></div><RecipeList recipes={topping.recipes} /></div>)}</div>
              </details>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
