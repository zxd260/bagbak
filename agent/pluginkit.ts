
export function plugins() {
  const {
    LSApplicationWorkspace,
    NSString,
    NSMutableArray,
    NSPredicate,
    NSBundle
  } = ObjC.classes;

  const args = NSMutableArray.alloc().init();
  args.setObject_atIndex_(NSBundle.mainBundle().bundleIdentifier(), 0);
  const fmt = NSString.stringWithString_('containingBundle.applicationIdentifier=%@');
  const predicate = NSPredicate.predicateWithFormat_argumentArray_(fmt, args);
  const plugins = LSApplicationWorkspace.defaultWorkspace()
    .installedPlugins().filteredArrayUsingPredicate_(predicate);
  const result = [];
  for (let i = 0; i < plugins.count(); i++) {
    result.push(plugins.objectAtIndex_(i).pluginIdentifier().toString());
  }
  args.release();
  return result;
}


export function launch(id: string) {
  const { NSExtension, NSString } = ObjC.classes;

  const identifier = NSString.stringWithString_(id);
  const extension = NSExtension.extensionWithIdentifier_error_(identifier, NULL);
  identifier.release();
  if (!extension)
    return Promise.reject(`unable to create extension ${id}`);

  const pid = extension['- _plugInProcessIdentifier']();
  if (pid)
    return Promise.resolve(pid);

  return new Promise((resolve, reject) => {
    extension.beginExtensionRequestWithInputItems_completion_(NULL, new ObjC.Block({
      retType: 'void',
      argTypes: ['object'],
      implementation(requestIdentifier) {
        const pid = extension.pidForRequestIdentifier_(requestIdentifier);
        extension.release();
        resolve(pid);
      }
    }))
  })
}

export function launchAll() {
  // hack: load NSExtensionContext subclasses

  // IntentsUI: _INUIExtensionHostContext
  // UserNotifications: _UNNotificationServiceExtensionHostContext
  // Messages: _MSMessageAppExtensionHostContext
  const frameworks = ['UserNotifications', 'IntentsUI', 'Messages']
  for (let name of frameworks) {
    const bundle = ObjC.classes.NSBundle.bundleWithPath_(`/System/Library/Frameworks/${name}.framework`)
    if (bundle)
      bundle.load()
  }

  return Promise.all(plugins().map(id => launch(id)));
}