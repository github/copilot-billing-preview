type TrieNode = {
  children: Map<string, TrieNode>
  indices: number[]
}

export class Trie {
  private root: TrieNode = { children: new Map(), indices: [] }

  insert(word: string, index: number): void {
    let node = this.root
    node.indices.push(index)

    for (const ch of word) {
      let next = node.children.get(ch)
      if (!next) {
        next = { children: new Map(), indices: [] }
        node.children.set(ch, next)
      }
      node = next
      node.indices.push(index)
    }
  }

  searchPrefix(prefix: string): number[] {
    if (!prefix) return this.root.indices

    let node = this.root
    for (const ch of prefix) {
      const next = node.children.get(ch)
      if (!next) return []
      node = next
    }
    return node.indices
  }
}
