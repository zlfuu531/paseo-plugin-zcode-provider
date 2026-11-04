import { AdapterError } from "./errors.js";
import type { HostBridge } from "./host/bridge.js";
import { catalogModels, encodeModel } from "./mapping.js";
import {
  ModelSelectionViewSchema,
  type ModelSelection,
  type ModelSelectionView,
} from "./host/schemas.js";

export async function readModelSelection(
  bridge: HostBridge,
  selection?: ModelSelection,
): Promise<ModelSelectionView> {
  const view = await bridge.request(
    "readModelSelection",
    { selection },
    ModelSelectionViewSchema,
    60_000,
  );
  catalogModels(view.models, view.preferredSelection);
  if (view.models.length === 0)
    throw new AdapterError(
      "AUTH_REQUIRED",
      "No usable ZCode model provider is configured",
    );
  return view;
}

export async function resolveModelSelection(
  bridge: HostBridge,
  view: ModelSelectionView,
  selection: ModelSelection,
  allowFallback = false,
): Promise<ModelSelection> {
  const requestedModel = view.models.find(
    (item) => encodeModel(item.ref) === encodeModel(selection),
  );
  // A persisted session can outlive its selected provider or model. Only
  // session restoration opts into this fallback so explicit model changes
  // continue to fail when the requested model is unavailable.
  const preferredModel = view.preferredSelection
    ? view.models.find(
        (item) =>
          encodeModel(item.ref) === encodeModel(view.preferredSelection!),
      )
    : undefined;
  const model =
    requestedModel ??
    (allowFallback ? (preferredModel ?? view.models[0]) : undefined);
  if (!model)
    throw new AdapterError("INVALID_CONFIGURATION", "Unknown ZCode model");
  const selectedModel = {
    providerId: model.ref.providerId,
    modelId: model.ref.modelId,
  };
  // ZCode's projectAppModelOption uses the last advertised level as default.
  // Model IDs and reasoning controls remain separate in Paseo.
  const requestedReasoningLevel = selection.options?.reasoningLevel;
  const reasoningLevel =
    requestedReasoningLevel &&
    (requestedModel || model.reasoningLevels.includes(requestedReasoningLevel))
      ? requestedReasoningLevel
      : model.reasoningLevels.at(-1)!;
  if (!model.reasoningLevels.includes(reasoningLevel))
    throw new AdapterError(
      "INVALID_CONFIGURATION",
      "Unknown ZCode thinking option",
    );
  const resolved = await readModelSelection(bridge, {
    ...selectedModel,
    options: { reasoningLevel },
  });
  if (resolved.selectionIssue || !resolved.effectiveSelection)
    throw new AdapterError(
      "INVALID_CONFIGURATION",
      "ZCode model selection is unavailable",
    );
  if (encodeModel(resolved.effectiveSelection) !== encodeModel(selectedModel))
    throw new AdapterError(
      "INVALID_CONFIGURATION",
      "ZCode resolved a different model; select it explicitly",
    );
  if (resolved.effectiveSelection.options?.reasoningLevel !== reasoningLevel)
    throw new AdapterError(
      "INVALID_CONFIGURATION",
      "ZCode resolved a different reasoning level",
    );
  return resolved.effectiveSelection;
}
