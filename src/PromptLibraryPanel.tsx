import { useEffect, useId, useMemo, useState, type DragEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  GripVertical,
  ImagePlus,
  LoaderCircle,
  PanelRightClose,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";

export type PromptLibraryCase = {
  id: number | string;
  title: string;
  image: string;
  sourceLabel?: string;
  sourceUrl?: string;
  prompt: string;
  nanoPrompt?: string;
  gptImage2Prompt?: string;
  category: string;
  /** A case may appear in more than one category filter. */
  categories?: string[];
  styles: string[];
  scenes: string[];
  featured: boolean;
  template?: boolean;
  industry?: boolean;
  githubUrl?: string;
};

type PromptCatalog = {
  totalCases: number;
  categories: string[];
  styles: string[];
  scenes: string[];
  cases: PromptLibraryCase[];
  templates?: PromptLibraryCase[];
  industryCases?: PromptLibraryCase[];
};

const PAGE_SIZE = 24;
const CUSTOM_CASES_KEY = "disy-prompt-library-custom-v2";
const HIDDEN_CASES_KEY = "disy-prompt-library-hidden-v2";
const CUSTOM_CATEGORIES_KEY = "disy-prompt-library-categories-v2";
const CATEGORY_SETTINGS_KEY = "disy-prompt-library-category-settings-v2";
const CASE_OVERRIDES_KEY = "disy-prompt-library-case-overrides-v1";
const RESET_CATEGORIES = ["金融科技", "人物海报", "角色设计", "3D视觉"];

const readCustomCases = (): PromptLibraryCase[] => {
  try {
    return JSON.parse(
      localStorage.getItem(CUSTOM_CASES_KEY) || "[]",
    ) as PromptLibraryCase[];
  } catch {
    return [];
  }
};
const readStringList = (key: string): string[] => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};
const readCategorySettings = (): {
  hidden: string[];
  names: Record<string, string>;
  order: string[];
} => {
  try {
    const value = JSON.parse(
      localStorage.getItem(CATEGORY_SETTINGS_KEY) || "{}",
    ) as { hidden?: unknown; names?: unknown; order?: unknown };
    return {
      hidden: Array.isArray(value.hidden)
        ? value.hidden.filter(
            (item: unknown): item is string => typeof item === "string",
          )
        : [],
      names:
        value.names && typeof value.names === "object"
          ? (value.names as Record<string, string>)
          : {},
      order: Array.isArray(value.order)
        ? value.order.filter(
            (item: unknown): item is string => typeof item === "string",
          )
        : [],
    };
  } catch {
    return { hidden: [], names: {}, order: [] };
  }
};
const saveCustomCases = (items: PromptLibraryCase[]) =>
  localStorage.setItem(CUSTOM_CASES_KEY, JSON.stringify(items));
type CaseOverride = Pick<PromptLibraryCase, "title" | "prompt" | "category"> & {
  categories: string[];
  nanoPrompt?: string;
  gptImage2Prompt?: string;
};
const readCaseOverrides = (): Record<string, CaseOverride> => {
  try {
    const value = JSON.parse(localStorage.getItem(CASE_OVERRIDES_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, CaseOverride>)
      : {};
  } catch {
    return {};
  }
};

// A prompt-library example can become an img2img reference later. Keep its
// original pixels and format instead of permanently creating a tiny WebP preview.
const compressReference = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      const scale = Math.min(
        1,
        1024 / Math.max(image.naturalWidth, image.naturalHeight),
      );
      if (scale === 1 && file.type !== "image/webp") {
        const reader = new FileReader();
        reader.onload = () => {
          URL.revokeObjectURL(url);
          resolve(String(reader.result));
        };
        reader.onerror = () => {
          URL.revokeObjectURL(url);
          reject(reader.error ?? new Error("image"));
        };
        reader.readAsDataURL(file);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas
        .getContext("2d")
        ?.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const outputType =
        file.type === "image/jpeg" ? "image/jpeg" : "image/png";
      resolve(canvas.toDataURL(outputType, 0.92));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    image.src = url;
  });

type Props = {
  open: boolean;
  onClose: () => void;
  onUsePrompt: (item: PromptLibraryCase) => void;
  onAddImage: (item: PromptLibraryCase) => void;
  textModels: Array<{
    key: string;
    name: string;
    connectionName: string;
  }>;
  defaultTextModelKey?: string;
  onReversePrompts: (
    image: string,
    textModelKey: string,
  ) => Promise<{ title?: string; nanoPrompt: string; gptImage2Prompt: string }>;
};

export function PromptLibraryPanel({
  open,
  onClose,
  onUsePrompt,
  onAddImage,
  textModels,
  defaultTextModelKey,
  onReversePrompts,
}: Props) {
  const reduceMotion = useReducedMotion();
  const [catalog, setCatalog] = useState<PromptCatalog | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<PromptLibraryCase | null>(null);
  const [copied, setCopied] = useState(false);
  const [promptModel, setPromptModel] = useState<"nano" | "gpt-image-2">(
    "nano",
  );
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [customCases, setCustomCases] =
    useState<PromptLibraryCase[]>(readCustomCases);
  const [hiddenCaseIds, setHiddenCaseIds] = useState<string[]>(() =>
    readStringList(HIDDEN_CASES_KEY),
  );
  const [customCategories, setCustomCategories] = useState<string[]>(() =>
    readStringList(CUSTOM_CATEGORIES_KEY),
  );
  const [categorySettings, setCategorySettings] =
    useState(readCategorySettings);
  const [caseOverrides, setCaseOverrides] =
    useState<Record<string, CaseOverride>>(readCaseOverrides);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [pendingDeleteCategory, setPendingDeleteCategory] = useState<
    string | null
  >(null);
  const [pendingDeleteCase, setPendingDeleteCase] =
    useState<PromptLibraryCase | null>(null);
  const [draft, setDraft] = useState({
    title: "",
    nanoPrompt: "",
    gptImage2Prompt: "",
    category: "",
    image: "",
  });
  const [reverseBusy, setReverseBusy] = useState(false);
  const [reverseError, setReverseError] = useState("");
  const [reverseTextModelKey, setReverseTextModelKey] = useState(
    defaultTextModelKey || "",
  );
  const [reverseModelMenuOpen, setReverseModelMenuOpen] = useState(false);
  const [creatorCategoryOpen, setCreatorCategoryOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<PromptLibraryCase | null>(
    null,
  );
  const [editDraft, setEditDraft] = useState({
    title: "",
    nanoPrompt: "",
    gptImage2Prompt: "",
    categories: [] as string[],
  });
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (pendingDeleteCase) setPendingDeleteCase(null);
      else if (pendingDeleteCategory) setPendingDeleteCategory(null);
      else if (editingCategory) setEditingCategory(null);
      else if (editingCase) setEditingCase(null);
      else if (creatorCategoryOpen) setCreatorCategoryOpen(false);
      else if (reverseModelMenuOpen) setReverseModelMenuOpen(false);
      else if (creatorOpen) setCreatorOpen(false);
      else if (selected) setSelected(null);
      else if (categoryManagerOpen) setCategoryManagerOpen(false);
      else onClose();
    };
    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, [categoryManagerOpen, creatorCategoryOpen, creatorOpen, editingCase, editingCategory, onClose, open, pendingDeleteCase, pendingDeleteCategory, reverseModelMenuOpen, selected]);
  const creatorCategoryMenuId = useId();
  const reverseModelMenuId = useId();
  const reverseTextModel = textModels.find(
    (model) => model.key === reverseTextModelKey,
  );

  useEffect(() => {
    const isCurrentModelAvailable = textModels.some(
      (model) => model.key === reverseTextModelKey,
    );
    if (!isCurrentModelAvailable) {
      setReverseTextModelKey(defaultTextModelKey || textModels[0]?.key || "");
    }
  }, [defaultTextModelKey, reverseTextModelKey, textModels]);

  useEffect(() => {
    if (!open || catalog) return;
    fetch("/prompt-library/catalog.json")
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then((data: PromptCatalog) => setCatalog(data))
      .catch(() => setError("灵感库加载失败，请刷新后重试"));
  }, [catalog, open]);

  const results = useMemo(() => {
    if (!catalog) return [];
    const normalized = query.trim().toLocaleLowerCase();
    const sourceItems = [
      ...(catalog.cases || []),
      ...(catalog.industryCases || []),
      ...customCases,
    ].map((item) => ({ ...item, ...(caseOverrides[String(item.id)] || {}) }));
    return sourceItems.filter((item) => {
      if (hiddenCaseIds.includes(String(item.id))) return false;
      const itemCategories = item.categories?.length
        ? item.categories
        : [item.category];
      if (category !== "all" && !itemCategories.includes(category))
        return false;
      if (!normalized) return true;
      return [
        item.title,
        item.prompt,
        item.nanoPrompt,
        item.gptImage2Prompt,
        item.sourceLabel,
        item.category,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLocaleLowerCase().includes(normalized),
        );
    });
  }, [catalog, caseOverrides, category, customCases, hiddenCaseIds, query]);
  const categories = useMemo(() => {
    const known = [
      ...RESET_CATEGORIES,
      ...Array.from(
        new Set([
          ...customCategories,
          ...customCases.flatMap((item) =>
            item.categories?.length ? item.categories : [item.category],
          ),
        ]),
      ).filter((value) => value && !RESET_CATEGORIES.includes(value)),
    ];
    const ordered = categorySettings.order.filter((value) =>
      known.includes(value),
    );
    return [...ordered, ...known.filter((value) => !ordered.includes(value))];
  }, [categorySettings.order, customCategories, customCases]);
  const visibleCategories = useMemo(
    () =>
      categories.filter((value) => !categorySettings.hidden.includes(value)),
    [categories, categorySettings.hidden],
  );
  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const pageCases = useMemo(
    () => results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [page, results],
  );

  useEffect(() => {
    setPage(1);
    setSelected(null);
  }, [category, query]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  if (!open) return null;

  const beginDrag = (event: DragEvent, item: PromptLibraryCase) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(
      "application/x-disy-prompt-case",
      JSON.stringify(item),
    );
    event.dataTransfer.setData("text/plain", item.prompt);
  };

  const deleteCase = (item: PromptLibraryCase) => {
    setPendingDeleteCase(item);
  };

  const confirmDeleteCase = () => {
    const item = pendingDeleteCase;
    if (!item) return;
    if (String(item.id).startsWith("custom-")) {
      const next = customCases.filter((current) => current.id !== item.id);
      saveCustomCases(next);
      setCustomCases(next);
    } else {
      const next = Array.from(new Set([...hiddenCaseIds, String(item.id)]));
      localStorage.setItem(HIDDEN_CASES_KEY, JSON.stringify(next));
      setHiddenCaseIds(next);
    }
    setSelected(null);
    setPendingDeleteCase(null);
  };

  const deleteCategory = (value: string) => {
    const nextSettings = {
      ...categorySettings,
      hidden: Array.from(new Set([...categorySettings.hidden, value])),
    };
    localStorage.setItem(CATEGORY_SETTINGS_KEY, JSON.stringify(nextSettings));
    setCategorySettings(nextSettings);
    if (category === value) setCategory("all");
  };

  const renameCategory = (value: string) => {
    const nextName = categoryDraft.trim();
    if (!nextName) return;
    const nextSettings = {
      ...categorySettings,
      names: { ...categorySettings.names, [value]: nextName },
    };
    localStorage.setItem(CATEGORY_SETTINGS_KEY, JSON.stringify(nextSettings));
    setCategorySettings(nextSettings);
    setEditingCategory(null);
    setCategoryDraft("");
  };

  const categoryName = (value: string) =>
    categorySettings.names[value] || value;

  const categoriesFor = (item: PromptLibraryCase) =>
    item.categories?.length ? item.categories : [item.category];

  const promptFor = (item: PromptLibraryCase) =>
    promptModel === "gpt-image-2"
      ? item.gptImage2Prompt || item.prompt
      : item.nanoPrompt || item.prompt;

  const saveCaseEdit = () => {
    if (
      !editingCase ||
      !editDraft.title.trim() ||
      !editDraft.nanoPrompt.trim() ||
      !editDraft.gptImage2Prompt.trim() ||
      !editDraft.categories.length
    )
      return;
    const categoriesForCase = Array.from(new Set(editDraft.categories));
    const categoryForCase = categoriesForCase[0];
    const nanoPrompt = editDraft.nanoPrompt.trim();
    const gptImage2Prompt = editDraft.gptImage2Prompt.trim();
    if (String(editingCase.id).startsWith("custom-")) {
      const next = customCases.map((item) =>
        item.id === editingCase.id
          ? {
              ...item,
              title: editDraft.title.trim(),
              prompt: nanoPrompt,
              nanoPrompt,
              gptImage2Prompt,
              category: categoryForCase,
              categories: categoriesForCase,
            }
          : item,
      );
      saveCustomCases(next);
      setCustomCases(next);
    } else {
      const next = {
        ...caseOverrides,
        [String(editingCase.id)]: {
          title: editDraft.title.trim(),
          prompt: nanoPrompt,
          nanoPrompt,
          gptImage2Prompt,
          category: categoryForCase,
          categories: categoriesForCase,
        },
      };
      localStorage.setItem(CASE_OVERRIDES_KEY, JSON.stringify(next));
      setCaseOverrides(next);
    }
    setSelected((current) =>
      current?.id === editingCase.id
        ? {
            ...current,
            title: editDraft.title.trim(),
            prompt: nanoPrompt,
            nanoPrompt,
            gptImage2Prompt,
            category: categoryForCase,
            categories: categoriesForCase,
          }
        : current,
    );
    setEditingCase(null);
  };

  const addCaseToCategory = (
    item: PromptLibraryCase,
    targetCategory: string,
  ) => {
    const nextCategories = Array.from(
      new Set([...categoriesFor(item), targetCategory]),
    );
    if (String(item.id).startsWith("custom-")) {
      const next = customCases.map((current) =>
        current.id === item.id
          ? {
              ...current,
              category: current.category || targetCategory,
              categories: nextCategories,
            }
          : current,
      );
      saveCustomCases(next);
      setCustomCases(next);
    } else {
      const previous = caseOverrides[String(item.id)];
      const next = {
        ...caseOverrides,
        [String(item.id)]: {
          title: previous?.title ?? item.title,
          prompt: previous?.prompt ?? item.prompt,
          nanoPrompt: previous?.nanoPrompt ?? item.nanoPrompt,
          gptImage2Prompt: previous?.gptImage2Prompt ?? item.gptImage2Prompt,
          category: previous?.category ?? item.category,
          categories: nextCategories,
        },
      };
      localStorage.setItem(CASE_OVERRIDES_KEY, JSON.stringify(next));
      setCaseOverrides(next);
    }
    setSelected((current) =>
      current?.id === item.id
        ? { ...current, categories: nextCategories }
        : current,
    );
  };

  const moveCategory = (sourceCategory: string, targetCategory: string) => {
    if (!sourceCategory || sourceCategory === targetCategory) return;
    const next = categories.filter((value) => value !== sourceCategory);
    const targetIndex = next.indexOf(targetCategory);
    next.splice(targetIndex < 0 ? next.length : targetIndex, 0, sourceCategory);
    const nextSettings = { ...categorySettings, order: next };
    localStorage.setItem(CATEGORY_SETTINGS_KEY, JSON.stringify(nextSettings));
    setCategorySettings(nextSettings);
    setDraggedCategory(null);
  };

  const reverseCreatorPrompts = async () => {
    if (!draft.image || reverseBusy) return;
    setReverseBusy(true);
    setReverseError("");
    try {
      const result = await onReversePrompts(draft.image, reverseTextModelKey);
      setDraft((current) => ({
        ...current,
        title: current.title.trim() || result.title?.trim() || "",
        nanoPrompt: result.nanoPrompt.trim(),
        gptImage2Prompt: result.gptImage2Prompt.trim(),
      }));
    } catch (error) {
      setReverseError(
        error instanceof Error
          ? error.message
          : "反推提示词失败，请检查文本模型后重试",
      );
    } finally {
      setReverseBusy(false);
    }
  };

  return (
    <motion.div
      className="prompt-library-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : .2, ease: "easeOut" }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(event) => {
        event.preventDefault();
        const payload = event.dataTransfer.getData(
          "application/x-disy-prompt-case",
        );
        if (payload) onAddImage(JSON.parse(payload) as PromptLibraryCase);
      }}
    >
      <motion.section
        className="prompt-library-panel"
        initial={reduceMotion ? false : { opacity: 0, y: 18, scale: .985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: .99 }}
        transition={{ type: "spring", stiffness: 360, damping: 34, mass: .72 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-library-title"
        onMouseDown={(event) => event.stopPropagation()}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => event.stopPropagation()}
      >
        <header className="prompt-library-header">
          <div className="prompt-library-heading">
            <span>
              <BookOpen size={18} />
            </span>
            <div>
              <h2 id="prompt-library-title">灵感库</h2>
              <small>
                {catalog ? `${catalog.totalCases} 个灵感案例` : "正在加载案例"}
              </small>
            </div>
          </div>
          <div className="prompt-header-actions">
            <button
              type="button"
              className="prompt-create-button"
              onClick={() => {
                setCreatorCategoryOpen(false);
                setCreatorOpen(true);
              }}
            >
              <Plus size={14} />
              添加我的案例
            </button>
            <button type="button" aria-label="关闭灵感库" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="prompt-library-search-row">
          <div className="prompt-library-view-tabs">
            <span>灵感案例</span>
            <b>{results.length}</b>
          </div>
          <label>
            <Search size={15} />
            <input
              autoFocus
              value={query}
              placeholder="搜索案例、风格或 Prompt"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <span>{results.length} 个匹配</span>
        </div>

        <div className="prompt-library-filter-strip">
          <div>
            <strong>分类</strong>
            <div className="prompt-filter-chips">
              <button
                className={category === "all" ? "is-active" : ""}
                onClick={() => setCategory("all")}
              >
                全部
              </button>
              {visibleCategories.map((value) => (
                <button
                  key={value}
                  draggable
                  className={`prompt-category-chip ${category === value ? "is-active" : ""} ${draggedCategory === value ? "is-dragging" : ""}`}
                  onDragStart={(event) => {
                    event.stopPropagation();
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData(
                      "application/x-disy-category",
                      value,
                    );
                    setDraggedCategory(value);
                  }}
                  onDragEnd={() => setDraggedCategory(null)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.dataTransfer.dropEffect =
                      event.dataTransfer.types.includes(
                        "application/x-disy-prompt-case",
                      )
                        ? "copy"
                        : "move";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const payload = event.dataTransfer.getData(
                      "application/x-disy-prompt-case",
                    );
                    if (payload)
                      addCaseToCategory(
                        JSON.parse(payload) as PromptLibraryCase,
                        value,
                      );
                    else
                      moveCategory(
                        event.dataTransfer.getData("application/x-disy-category"),
                        value,
                      );
                  }}
                  onClick={() => setCategory(value)}
                >
                  {categoryName(value)}
                </button>
              ))}
              <button
                className={`prompt-category-manage-trigger ${categoryManagerOpen ? "is-open" : ""}`}
                onClick={() => {
                  setCategoryManagerOpen((open) => !open);
                  setEditingCategory(null);
                  setPendingDeleteCategory(null);
                }}
              >
                <Settings2 size={12} />
                管理分类
              </button>
            </div>
          </div>
          <AnimatePresence>
          {categoryManagerOpen && (
            <motion.div className="prompt-category-manager" initial={reduceMotion ? false : { opacity: 0, y: -8, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: .99 }} transition={{ duration: reduceMotion ? 0 : .18, ease: [0.22, 1, 0.36, 1] }}>
              <header>
                <div>
                  <strong>管理分类</strong>
                  <small>改名或移除筛选项，案例仍保留在“全部”中</small>
                </div>
                <button
                  type="button"
                  aria-label="关闭分类管理"
                  onClick={() => setCategoryManagerOpen(false)}
                >
                  <X size={14} />
                </button>
              </header>
              <div className="prompt-category-manager-list">
                {categories.map((value) => {
                  const hidden = categorySettings.hidden.includes(value);
                  const editing = editingCategory === value;
                  const confirming = pendingDeleteCategory === value;
                  return (
                    <div
                      className={`prompt-category-manager-row ${hidden ? "is-hidden" : ""}`}
                      key={value}
                    >
                      <span className="prompt-category-status" />
                      {editing ? (
                        <input
                          autoFocus
                          value={categoryDraft}
                          onChange={(event) =>
                            setCategoryDraft(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") renameCategory(value);
                            if (event.key === "Escape")
                              setEditingCategory(null);
                          }}
                        />
                      ) : (
                        <div>
                          <strong>{categoryName(value)}</strong>
                          <small>
                            {hidden ? "已从筛选中移除" : "正在使用"}
                          </small>
                        </div>
                      )}
                      {confirming ? (
                        <div className="prompt-category-confirm">
                          <span>确定移除？</span>
                          <button
                            onClick={() => setPendingDeleteCategory(null)}
                          >
                            取消
                          </button>
                          <button
                            className="is-danger"
                            onClick={() => {
                              deleteCategory(value);
                              setPendingDeleteCategory(null);
                            }}
                          >
                            移除
                          </button>
                        </div>
                      ) : hidden ? (
                        <button
                          className="prompt-category-restore"
                          onClick={() => {
                            const nextSettings = {
                              ...categorySettings,
                              hidden: categorySettings.hidden.filter(
                                (item) => item !== value,
                              ),
                            };
                            localStorage.setItem(
                              CATEGORY_SETTINGS_KEY,
                              JSON.stringify(nextSettings),
                            );
                            setCategorySettings(nextSettings);
                          }}
                        >
                          恢复
                        </button>
                      ) : (
                        <div className="prompt-category-row-actions">
                          {editing ? (
                            <>
                              <button onClick={() => setEditingCategory(null)}>
                                取消
                              </button>
                              <button
                                className="is-primary"
                                onClick={() => renameCategory(value)}
                              >
                                保存
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditingCategory(value);
                                  setCategoryDraft(categoryName(value));
                                  setPendingDeleteCategory(null);
                                }}
                              >
                                重命名
                              </button>
                              <button
                                className="is-danger"
                                onClick={() => {
                                  setPendingDeleteCategory(value);
                                  setEditingCategory(null);
                                }}
                              >
                                移除
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>

        <motion.div
          layout
          className={`prompt-library-content ${selected ? "has-detail" : ""}`}
          transition={{ layout: { duration: reduceMotion ? 0 : .28, ease: [0.22, 1, 0.36, 1] } }}
        >
          <motion.div className="prompt-case-grid" layout>
            {error && (
              <div className="prompt-library-state">
                <BookOpen size={28} />
                <strong>{error}</strong>
              </div>
            )}
            {!catalog && !error && (
              <div className="prompt-library-state">
                <span className="prompt-library-spinner" />
                <strong>正在载入压缩案例图…</strong>
              </div>
            )}
            {catalog && !results.length && (
              <div className="prompt-library-state">
                <Search size={28} />
                <strong>没有找到匹配案例</strong>
                <span>试试减少筛选条件</span>
              </div>
            )}
            {pageCases.map((item, index) => (
              <motion.article
                layout="position"
                key={item.id}
                className={`prompt-case-card ${selected?.id === item.id ? "is-selected" : ""}`}
                initial={reduceMotion ? false : { opacity: 0, y: 10, scale: .985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: reduceMotion ? 0 : .22, delay: reduceMotion ? 0 : Math.min(index, 11) * .018, ease: [0.22, 1, 0.36, 1] }}
                whileHover={reduceMotion ? undefined : { y: -3 }}
                whileTap={reduceMotion ? undefined : { scale: .992 }}
                draggable
                onDragStart={(event) => beginDrag(event as unknown as DragEvent, item)}
                onClick={() => setSelected(item)}
              >
                <div className="prompt-case-image">
                  <img
                    loading="lazy"
                    decoding="async"
                    src={item.image}
                    alt={item.title}
                  />
                  <button
                    type="button"
                    className="prompt-case-remove"
                    title="从灵感案例移除"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteCase(item);
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="prompt-case-copy">
                  <strong>{item.title}</strong>
                  <p>{item.nanoPrompt || item.prompt}</p>
                </div>
              </motion.article>
            ))}
            {results.length > PAGE_SIZE && (
              <nav className="prompt-pagination" aria-label="灵感库分页">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  <ChevronLeft size={14} />
                  上一页
                </button>
                <span>
                  第 <strong>{page}</strong> / {totalPages} 页 · 本页{" "}
                  {pageCases.length} 个
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((value) => Math.min(totalPages, value + 1))
                  }
                >
                  下一页
                  <ChevronRight size={14} />
                </button>
              </nav>
            )}
          </motion.div>

          <AnimatePresence mode="popLayout">
          {selected && (
            <motion.aside
              key={String(selected.id)}
              layout
              className="prompt-case-detail"
              initial={reduceMotion ? false : { opacity: 0, x: 26 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 18 }}
              transition={{ duration: reduceMotion ? 0 : .24, ease: [0.22, 1, 0.36, 1] }}
              draggable
              onDragStart={(event) => beginDrag(event as unknown as DragEvent, selected)}
            >
              <div className="prompt-detail-toolbar">
                <span>案例详情</span>
                <button
                  type="button"
                  title="关闭案例详情"
                  aria-label="关闭案例详情"
                  onClick={() => setSelected(null)}
                >
                  <PanelRightClose size={16} />
                </button>
              </div>
              <div
                className="prompt-detail-image"
                draggable
                onDragStart={(event) => beginDrag(event, selected)}
              >
                <img src={selected.image} alt={selected.title} />
                <span>
                  <GripVertical size={13} />
                  拖动参考图到画布
                </span>
              </div>
              <div className="prompt-detail-title">
                <div>
                  <small>
                    {selected.industry
                      ? "行业灵感"
                      : selected.sourceLabel === "我的创作"
                        ? "我的创作"
                        : `CASE ${selected.id}`}
                  </small>
                  <h3>{selected.title}</h3>
                </div>
                <div className="prompt-detail-title-actions">
                  {selected.sourceUrl && (
                    <a
                      href={selected.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="查看原始来源"
                    >
                      <ArrowUpRight size={16} />
                    </a>
                  )}
                  <button
                    type="button"
                    title="从灵感案例移除"
                    onClick={() => deleteCase(selected)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="prompt-detail-tags" aria-label="案例分类">
                {categoriesFor(selected).map((value) => (
                  <span key={value}>{categoryName(value)}</span>
                ))}
              </div>
              <div
                className="prompt-model-tabs"
                role="tablist"
                aria-label="提示词模型"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={promptModel === "nano"}
                  className={promptModel === "nano" ? "is-active" : ""}
                  onClick={() => setPromptModel("nano")}
                >
                  Nano Banana
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={promptModel === "gpt-image-2"}
                  className={promptModel === "gpt-image-2" ? "is-active" : ""}
                  onClick={() => setPromptModel("gpt-image-2")}
                >
                  GPT Image 2
                </button>
              </div>
              <div className="prompt-detail-prompt">
                <div>
                  <strong>
                    {promptModel === "nano"
                      ? "Nano Banana 提示词"
                      : "GPT Image 2 提示词"}
                  </strong>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(promptFor(selected));
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1400);
                    }}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? "已复制" : "复制"}
                  </button>
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p key={`${selected.id}-${promptModel}`} initial={reduceMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: reduceMotion ? 0 : .14 }}>{promptFor(selected)}</motion.p>
                </AnimatePresence>
              </div>
              <div className="prompt-detail-actions">
                <button
                  onClick={() => {
                    setEditingCase(selected);
                    setEditDraft({
                      title: selected.title,
                      nanoPrompt: selected.nanoPrompt || selected.prompt,
                      gptImage2Prompt:
                        selected.gptImage2Prompt || selected.prompt,
                      categories: categoriesFor(selected),
                    });
                  }}
                >
                  <Settings2 size={15} />
                  编辑案例
                </button>
                <button
                  onClick={() =>
                    onUsePrompt({ ...selected, prompt: promptFor(selected) })
                  }
                >
                  <BookOpen size={15} />
                  一键复刻
                </button>
                <button onClick={() => onAddImage(selected)}>
                  <ImagePlus size={15} />
                  加入画布
                </button>
              </div>
              <footer>
                案例来自{" "}
                <a
                  href={selected.sourceUrl || selected.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {selected.sourceLabel || "原项目收录来源"}
                </a>
                。使用前请自行确认原作者授权。
              </footer>
            </motion.aside>
          )}
          </AnimatePresence>
        </motion.div>
      </motion.section>
      <AnimatePresence>
      {creatorOpen && (
        <motion.div
          className="prompt-creator-backdrop"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : .16 }}
          onMouseDown={() => setCreatorOpen(false)}
        >
          <motion.form
            className="prompt-creator-dialog"
            initial={reduceMotion ? false : { opacity: 0, y: 14, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: .99 }} transition={{ duration: reduceMotion ? 0 : .2, ease: [0.22, 1, 0.36, 1] }}
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              if (
                !draft.title.trim() ||
                !draft.nanoPrompt.trim() ||
                !draft.gptImage2Prompt.trim() ||
                !draft.image
              )
                return;
              const selectedCategory = draft.category.trim() || "未分类";
              const nanoPrompt = draft.nanoPrompt.trim();
              const gptImage2Prompt = draft.gptImage2Prompt.trim();
              const item: PromptLibraryCase = {
                id: `custom-${crypto.randomUUID()}`,
                title: draft.title.trim(),
                prompt: nanoPrompt,
                nanoPrompt,
                gptImage2Prompt,
                image: draft.image,
                category: selectedCategory,
                categories: [selectedCategory],
                styles: [],
                scenes: [],
                featured: false,
                sourceLabel: "我的创作",
              };
              const next = [item, ...customCases];
              try {
                saveCustomCases(next);
                setCustomCases(next);
                if (
                  !RESET_CATEGORIES.includes(selectedCategory) &&
                  !customCategories.includes(selectedCategory)
                ) {
                  const nextCategories = [
                    ...customCategories,
                    selectedCategory,
                  ];
                  localStorage.setItem(
                    CUSTOM_CATEGORIES_KEY,
                    JSON.stringify(nextCategories),
                  );
                  setCustomCategories(nextCategories);
                }
                setSelected(item);
                setCreatorOpen(false);
                setDraft({
                  title: "",
                  nanoPrompt: "",
                  gptImage2Prompt: "",
                  category: "",
                  image: "",
                });
                setReverseError("");
              } catch {
                setError("本地空间不足，请减少自定义案例或使用更小的参考图");
              }
            }}
          >
            <header>
              <div>
                <small>MY PROMPT</small>
                <h3>添加我的案例</h3>
              </div>
              <button type="button" onClick={() => setCreatorOpen(false)}>
                <X size={17} />
              </button>
            </header>
            <label className="prompt-upload-field">
              {draft.image ? (
                <img src={draft.image} alt="参考图预览" />
              ) : (
                <>
                  <Upload size={20} />
                  <strong>上传参考图</strong>
                  <small>会自动压缩为最长边 640px WebP</small>
                </>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    setReverseError("");
                    void compressReference(file).then((image) =>
                      setDraft((current) => ({ ...current, image })),
                    );
                  }
                }}
              />
            </label>
            <label>
              案例名称
              <input
                value={draft.title}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
            </label>
            <div className="prompt-reverse-bar">
              <div className="prompt-reverse-copy"><Sparkles size={15} /><span><strong>AI 反推双模型提示词</strong><small>选择视觉文本模型后，分析参考图并分别填写两套可直接生成的指令</small></span></div>
              <div className={`prompt-reverse-model-select agent-custom-select ${reverseModelMenuOpen ? "is-open" : ""}`}>
                <span>分析模型</span>
                <button
                  type="button"
                  className="agent-select-trigger"
                  aria-haspopup="listbox"
                  aria-expanded={reverseModelMenuOpen}
                  aria-controls={reverseModelMenuId}
                  disabled={reverseBusy || !textModels.length}
                  onClick={() => setReverseModelMenuOpen((open) => !open)}
                >
                  <Sparkles className="agent-select-icon" size={13} />
                  <span className={`agent-select-value ${reverseTextModel ? "" : "is-placeholder"}`}>{reverseTextModel?.name || "请先启用文本模型"}</span>
                  <ChevronDown className="agent-select-chevron" size={14} />
                </button>
                {reverseModelMenuOpen && (
                  <div id={reverseModelMenuId} className="prompt-reverse-model-menu agent-select-menu" role="listbox" aria-label="反推提示词文本模型">
                    {textModels.map((model) => {
                      const selectedModel = model.key === reverseTextModelKey;
                      return <button
                        type="button"
                        key={model.key}
                        role="option"
                        aria-selected={selectedModel}
                        className={selectedModel ? "is-selected" : ""}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setReverseTextModelKey(model.key);
                          setReverseModelMenuOpen(false);
                        }}
                      >
                        <span><strong>{model.name}</strong><small>{model.connectionName}</small></span>
                        {selectedModel && <Check size={14} />}
                      </button>;
                    })}
                  </div>
                )}
              </div>
              <button type="button" disabled={!draft.image || reverseBusy || !reverseTextModelKey} onClick={() => void reverseCreatorPrompts()}>
                {reverseBusy ? <LoaderCircle className="is-spinning" size={14} /> : <Sparkles size={14} />}
                {reverseBusy ? "正在分析图片…" : draft.nanoPrompt || draft.gptImage2Prompt ? "重新反推" : "反推提示词"}
              </button>
            </div>
            {reverseError && <div className="prompt-reverse-error">{reverseError}</div>}
            <div className="prompt-creator-model-fields">
              <label><span>Nano Banana 提示词</span><small>可直接文生图：写清画幅、主体数量和动作、前中后景、全部物件与位置、材质、光线、镜头、色彩与明确禁止项；图生图时沿用这些约束。</small><textarea value={draft.nanoPrompt} placeholder="上传图片后点击反推，或手动写入一段可直接执行的 Nano Banana 指令" onChange={(event) => setDraft((current) => ({ ...current, nanoPrompt: event.target.value }))} /></label>
              <label><span>GPT Image 2 提示词</span><small>细化造型、渲染风格、材质、灯光与镜头</small><textarea value={draft.gptImage2Prompt} placeholder="上传图片后点击反推，或手动填写 GPT Image 2 提示词" onChange={(event) => setDraft((current) => ({ ...current, gptImage2Prompt: event.target.value }))} /></label>
            </div>
            <div className="prompt-creator-fields">
              <label>
                分类（支持自建）
                <div
                  className={`prompt-category-select ${creatorCategoryOpen ? "is-open" : ""}`}
                >
                  <div>
                    <input
                      role="combobox"
                      aria-expanded={creatorCategoryOpen}
                      aria-controls={creatorCategoryMenuId}
                      aria-autocomplete="list"
                      value={draft.category}
                      placeholder="选择或输入新分类"
                      onFocus={() => setCreatorCategoryOpen(true)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape")
                          setCreatorCategoryOpen(false);
                        if (event.key === "ArrowDown")
                          setCreatorCategoryOpen(true);
                      }}
                      onChange={(event) => {
                        setDraft((current) => ({
                          ...current,
                          category: event.target.value,
                        }));
                        setCreatorCategoryOpen(true);
                      }}
                    />
                    <button
                      type="button"
                      aria-label="展开分类"
                      aria-expanded={creatorCategoryOpen}
                      onClick={() => setCreatorCategoryOpen((value) => !value)}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                  {creatorCategoryOpen && (
                    <div
                      id={creatorCategoryMenuId}
                      className="prompt-category-select-menu"
                      role="listbox"
                    >
                      {categories.map((value) => (
                        <button
                          type="button"
                          role="option"
                          aria-selected={draft.category === value}
                          className={
                            draft.category === value ? "is-selected" : ""
                          }
                          key={value}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setDraft((current) => ({
                              ...current,
                              category: value,
                            }));
                            setCreatorCategoryOpen(false);
                          }}
                        >
                          <span>{categoryName(value)}</span>
                          {draft.category === value && <Check size={13} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </label>
            </div>
            <footer>
              <button type="button" onClick={() => setCreatorOpen(false)}>
                取消
              </button>
              <button
                type="submit"
                disabled={
                  !draft.title.trim() || !draft.nanoPrompt.trim() || !draft.gptImage2Prompt.trim() || !draft.image || reverseBusy
                }
              >
                保存到灵感案例
              </button>
            </footer>
          </motion.form>
        </motion.div>
      )}
      </AnimatePresence>
      <AnimatePresence>
      {editingCase && (
        <motion.div
          className="prompt-editor-backdrop"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : .16 }}
          onMouseDown={() => setEditingCase(null)}
        >
          <motion.form
            className="prompt-editor-dialog"
            initial={reduceMotion ? false : { opacity: 0, y: 12, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .99 }} transition={{ duration: reduceMotion ? 0 : .2, ease: [0.22, 1, 0.36, 1] }}
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              saveCaseEdit();
            }}
          >
            <header>
              <div>
                <small>CASE EDITOR</small>
                <h3>编辑案例</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingCase(null)}
                aria-label="关闭编辑"
              >
                <X size={17} />
              </button>
            </header>
            <label>
              案例名称
              <input
                value={editDraft.title}
                onChange={(event) =>
                  setEditDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
            </label>
            <div className="prompt-editor-model-fields">
              <label>
                <span>Nano Banana 提示词</span>
                <textarea
                  value={editDraft.nanoPrompt}
                  onChange={(event) =>
                    setEditDraft((current) => ({
                      ...current,
                      nanoPrompt: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>GPT Image 2 提示词</span>
                <textarea
                  value={editDraft.gptImage2Prompt}
                  onChange={(event) =>
                    setEditDraft((current) => ({
                      ...current,
                      gptImage2Prompt: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <fieldset>
              <legend>归属分类（可多选）</legend>
              <div className="prompt-editor-category-options">
                {categories.map((value) => (
                  <label key={value}>
                    <input
                      type="checkbox"
                      checked={editDraft.categories.includes(value)}
                      onChange={() =>
                        setEditDraft((current) => ({
                          ...current,
                          categories: current.categories.includes(value)
                            ? current.categories.filter(
                                (item) => item !== value,
                              )
                            : [...current.categories, value],
                        }))
                      }
                    />
                    <span>{categoryName(value)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <footer>
              <button type="button" onClick={() => setEditingCase(null)}>
                取消
              </button>
              <button
                type="submit"
                disabled={
                  !editDraft.title.trim() ||
                  !editDraft.nanoPrompt.trim() ||
                  !editDraft.gptImage2Prompt.trim() ||
                  !editDraft.categories.length
                }
              >
                保存修改
              </button>
            </footer>
          </motion.form>
        </motion.div>
      )}
      </AnimatePresence>
      <AnimatePresence>
      {pendingDeleteCase && (
        <motion.div
          className="prompt-inline-confirm-backdrop"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : .14 }}
          role="presentation"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            if (event.target === event.currentTarget) setPendingDeleteCase(null);
          }}
        >
          <motion.section className="prompt-inline-confirm" role="alertdialog" aria-modal="true" aria-labelledby="prompt-delete-title" initial={reduceMotion ? false : { opacity: 0, y: 10, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .985 }} transition={{ duration: reduceMotion ? 0 : .18, ease: [0.22, 1, 0.36, 1] }} onClick={(event) => event.stopPropagation()}>
            <span className="prompt-inline-confirm-icon"><Trash2 size={17} /></span>
            <div>
              <h3 id="prompt-delete-title">确认删除案例？</h3>
              <p>“{pendingDeleteCase.title}”删除后仅影响当前浏览器，可刷新公共数据恢复。</p>
            </div>
            <footer>
              <button type="button" onClick={() => setPendingDeleteCase(null)}>取消</button>
              <button type="button" className="is-danger" onClick={confirmDeleteCase}>确认删除</button>
            </footer>
          </motion.section>
        </motion.div>
      )}
      </AnimatePresence>
    </motion.div>
  );
}
