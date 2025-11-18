
interface FeedPayload {
    type: "tweet"|"alert"|"store-bulletin";
    title: string;
    body?: string;
    sourceRef?: string;
}

export function useFeedBridge(): {
  postAlert: (payload: FeedPayload) => void;
} {
    const postAlert = (payload: FeedPayload) => {
        // This would dispatch an action to a global feed store (Zustand, Redux, etc.)
        console.log('Posting to feed:', payload);
    };

    return { postAlert };
};
