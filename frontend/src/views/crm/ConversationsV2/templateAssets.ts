export const templateProfileAvatars = Array.from({ length: 17 }, (_, index) => {
    const value = String(index + 1).padStart(2, '0')
    return `/mock/dreamschat/profiles/avatar-${value}.jpg`
})

export const templateEmojiIcons = [
    '/mock/dreamschat/icons/emonji-02.svg',
    '/mock/dreamschat/icons/emonji-05.svg',
    '/mock/dreamschat/icons/emonji-06.svg',
    '/mock/dreamschat/icons/emonji-07.svg',
    '/mock/dreamschat/icons/emonji-08.svg',
]

export const templateMediaMocks = {
    image: '/mock/dreamschat/video/video.jpg',
    audio: '/mock/dreamschat/audio/audio.mp3',
    video: '/mock/dreamschat/video/video.mp4',
    videoPoster: '/mock/dreamschat/video/user-image.jpg',
    attachment: '/mock/dreamschat/files/mock-note.txt',
}

export const getTemplateAvatar = (seed: string) => {
    const total = templateProfileAvatars.length
    if (!total) return null

    let hash = 0
    for (let index = 0; index < seed.length; index += 1) {
        hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
    }

    return templateProfileAvatars[hash % total]
}
