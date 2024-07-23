export function updateContainer(element: ReactNodeList, container: OpaqueRoot) {
  const current = container.current;
  updateContainerImpl();
}
