const isJavaScriptProtocol =
  /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*\:/i;

export default function sanitizeURL<T>(url: T): T | string {
  // We should never have symbols here because they get filtered out elsewhere.
  // eslint-disable-next-line react-internal/safe-string-coercion
  if (isJavaScriptProtocol.test("" + url)) {
    // Return a different javascript: url that doesn't cause any side-effects and just
    // throws if ever visited.
    // eslint-disable-next-line no-script-url
    return "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')";
  }
  return url;
}
