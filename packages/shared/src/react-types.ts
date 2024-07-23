export type ReactNode = React$Element<any> | ReactText;

export type ReactEmpty = null | void | boolean;

export type ReactFragment = ReactEmpty | Iterable<React$Node>;

export type ReactNodeList = ReactEmpty | React$Node;

export type ReactText = string | number;
