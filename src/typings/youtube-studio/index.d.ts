
declare module "youtube-studio"
{
    export interface YoutubeCookies
    {
        SID: string;
        HSID: string;
        SSID: string;
        APISID: string;
        SAPISID: string;
        LOGIN_INFO?: string;
        SESSION_TOKEN?: string;
    }

    // export enum VideoPrivacy
    // {
    //     PRIVATE = "PRIVATE",
    //     UNLISTED = "UNLISTED",
    //     PUBLIC = "PUBLIC"
    // }

    export interface UploadOptions
    {
        stream: import("stream").Readable;
        channelId?: string;
        newTitle?: string;
        newDescription?: string;
        newPrivacy?: string;
        isDraft?: boolean;
    }

    export function init(credentials: YoutubeCookies): Promise<void>;

    export function upload(options: UploadOptions): Promise<{[key: string]: any}>;
}
