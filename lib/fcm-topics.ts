/**
 * Normalize a free-form name (rebbe, tag, etc.) into a valid FCM topic
 * suffix. Must stay byte-identical to the iOS app's
 * NotificationManager.sanitizeTopicName (repo abbrach1/ytcalumni1) so a
 * topic produced by one side resolves to the same string on the other:
 *
 *   1. lowercase
 *   2. replace every non-alphanumeric Unicode scalar with "_" — uses
 *      \p{L} (any letter) and \p{N} (any digit) so Hebrew / non-ASCII
 *      tag names are preserved rather than collapsed to underscores.
 *      Multiple non-alnum chars in a row each become their own underscore
 *      (no collapsing).
 */
export function sanitizeTopicName(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "_")
}

export function rebbeTopic(name: string): string {
  return `rebbe_${sanitizeTopicName(name)}`
}

export function tagTopic(name: string): string {
  return `tag_${sanitizeTopicName(name)}`
}
