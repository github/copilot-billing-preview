export const UNLABELED_MODEL_NAME = 'Unlabeled'

export function getDisplayModelName(model: string | null | undefined): string {
  return model?.trim() || UNLABELED_MODEL_NAME
}
