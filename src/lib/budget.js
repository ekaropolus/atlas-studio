function isNumber(value) {
  return Number.isFinite(value)
}

function sum(values) {
  return values.reduce((total, value) => total + (isNumber(value) ? value : 0), 0)
}

function chapterRecord(state, chapterId) {
  return state?.chapters?.find((item) => item.id === chapterId) ?? null
}

function buildRankingMap(states, accessor) {
  return new Map(
    [...states]
      .map((state) => ({
        id: state.id,
        value: accessor(state),
      }))
      .filter((item) => isNumber(item.value))
      .sort((left, right) => right.value - left.value)
      .map((item, index) => [item.id, index + 1]),
  )
}

export function buildBudgetChapterRows(state, allStates, budgetBenchmarks) {
  if (!state?.chapters?.length || !allStates?.length || !budgetBenchmarks?.chapterShares) {
    return []
  }

  const coveredStates = allStates.filter((item) => isNumber(item.population) && isNumber(item.budgetExercised))
  const coveredPopulation = sum(coveredStates.map((item) => item.population))
  const amountRanksByChapter = new Map()
  const shareRanksByChapter = new Map()
  const perCapitaRanksByChapter = new Map()

  state.chapters.forEach((chapter) => {
    amountRanksByChapter.set(
      chapter.id,
      buildRankingMap(coveredStates, (item) => chapterRecord(item, chapter.id)?.amount),
    )
    shareRanksByChapter.set(
      chapter.id,
      buildRankingMap(coveredStates, (item) => chapterRecord(item, chapter.id)?.shareOfExercised),
    )
    perCapitaRanksByChapter.set(
      chapter.id,
      buildRankingMap(coveredStates, (item) => chapterRecord(item, chapter.id)?.perCapita),
    )
  })

  return state.chapters
    .map((chapter) => {
      const nationalAmount = budgetBenchmarks.chapterTotals?.[chapter.id] ?? null
      const nationalShare = budgetBenchmarks.chapterShares?.[chapter.id] ?? null
      const nationalPerCapita =
        isNumber(nationalAmount) && coveredPopulation > 0 ? nationalAmount / coveredPopulation : null
      const shareGap =
        isNumber(chapter.shareOfExercised) && isNumber(nationalShare)
          ? chapter.shareOfExercised - nationalShare
          : null
      const perCapitaGap =
        isNumber(chapter.perCapita) && isNumber(nationalPerCapita) ? chapter.perCapita - nationalPerCapita : null

      return {
        ...chapter,
        nationalAmount,
        nationalShare,
        nationalPerCapita,
        shareGap,
        perCapitaGap,
        amountRank: amountRanksByChapter.get(chapter.id)?.get(state.id) ?? null,
        shareRank: shareRanksByChapter.get(chapter.id)?.get(state.id) ?? null,
        perCapitaRank: perCapitaRanksByChapter.get(chapter.id)?.get(state.id) ?? null,
      }
    })
    .sort((left, right) => (right.amount ?? Number.NEGATIVE_INFINITY) - (left.amount ?? Number.NEGATIVE_INFINITY))
}

export function buildBudgetSourceRows(items, parentTotal) {
  if (!items?.length) {
    return []
  }

  const visibleTotal = sum(items.map((item) => item.amount))

  return [...items]
    .map((item) => ({
      ...item,
      shareOfParent:
        isNumber(item.amount) && visibleTotal > 0 ? item.amount / visibleTotal : null,
      parentTotal,
    }))
    .sort((left, right) => (right.amount ?? Number.NEGATIVE_INFINITY) - (left.amount ?? Number.NEGATIVE_INFINITY))
}
