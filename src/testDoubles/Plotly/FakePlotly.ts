import generateId from '@neurodevs/generate-id'

export const callsToPlotlyToImage: {
    root: Plotly.RootOrData
    opts?: Plotly.ToImgopts
}[] = []

export function resetCallsToPlotlyToImage() {
    callsToPlotlyToImage.length = 0
}

export let fakePngBufferResult = generateId()

export function setFakePngBufferResult(fakeResult: string) {
    fakePngBufferResult = fakeResult
}

export async function toImage(
    root: Plotly.RootOrData,
    opts?: Plotly.ToImgopts
) {
    callsToPlotlyToImage.push({ root, opts })
    return fakePngBufferResult
}

const Plotly = {
    toImage,
}

export default Plotly
