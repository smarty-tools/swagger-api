function getArgs(args) {
  const parsed = {};

  let currentKey = null;
  args.forEach(arg => {
    if (arg.startsWith('--')) {
      currentKey = arg.slice(2);
      parsed[currentKey] = true;
    } else if (currentKey) {
      parsed[currentKey] = arg;
      currentKey = null;
    } else {
      parsed._ = parsed._ || [];
      parsed._.push(arg);
    }
  });

  return parsed;
}


module.exports = getArgs;