const fs = require("fs/promises");
const path = require("path");
const getArgs = require("./utils");

const parsed = getArgs(process.argv.slice(2));

function getTemplateHeader(info) {
  return `
const baseUrl = "${info.baseUrl}";
`
};


function getPayload(method) {
  const arr = ["get", "delete", "head", "options"];
  if (arr.includes(method)) {
    return "{ params }";
  } else {
    // post、put、patch、postForm、putForm、patchForm
    return "params";
  }
}


function getApi(params, options) {
  const payload = getPayload(params.method);
  const url = options.prefix ? `\`\${baseUrl}${params.path}\`` : `"${params.path}"`;

  return `
/**
 * ${params.summary || "请补充描述..."}
 * @param {*} params
 * @returns
 */
export const ${params.operationId} = async (params) => {
  const response = await axiosInstance.${params.method}(${url}, ${payload});

  return response;
};
`
};

async function getRequestFile(json, options) {
  let str = "";
  const baseUrl = json.servers[0].url;
  str += getTemplateHeader({ baseUrl });

  const paths = Object.keys(json.paths);

  paths.forEach((path) => {
    const info = json.paths[path];
    const method = Object.keys(info)[0];

    const template = getApi({ path, method, ...info[method] }, options);

    str += `${template} \n`;
  });

  let outPath = path.resolve(__dirname, "api.js");
  const _path = parsed.o;
  if (_path && typeof _path !== "boolean") {
    outPath = path.resolve(_path, "api.js");
  }

  await fs.writeFile(outPath, str);

  return str;
};

module.exports = {
  getRequestFile
}