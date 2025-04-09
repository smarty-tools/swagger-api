const fs = require("fs/promises");
const path = require("path");
const getArgs = require("./utils");

const querystring = require("querystring");

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

function parseParams(params, schemas) {
  let url = params.path;
  let payload;
  let _params;
  const method = params.method;

  const arr = ["get", "delete", "head", "options"];
  if (arr.includes(method)) {
    payload = "{ params }";

    _params = params.parameters;
  } else {
    // post、put、patch、postForm、putForm、patchForm
    payload = "params";

    if (params.requestBody) {
      _params = params.requestBody.content;
    }

    // 针对post请求存在需要拼接query的情况
    if (params.parameters?.length) {
      const query = {};
      params.parameters.forEach(item => {
        const key = item.name;
        const schema = item.schema;
        if (schema.type) {
          query[key] = `\${params.${key}}`;
        } else if (schema.$ref) {
          const ref = schema.$ref.split("/").at(-1);
          const { properties } = schemas[ref];
          Object.keys(properties).forEach((key) => {
            query[key] = `\${params.${key}}`;
          })
        }
      })
      let querystr = querystring.stringify(query, "&", "=", { encodeURIComponent: (data) => data });
      url += `?${querystr}`
    }
  }

  return {
    url,
    payload,
    _params
  }
}


function getApi(params, options, schemas) {
  // const payload = getPayload(params.method);
  // let url = options.prefix ? `\`\${baseUrl}${params.path}\`` : `"${params.path}"`;

  // if (params.path === "/file/upload/resourcePositionImage") {
  //   console.log(params)
  //   // console.log(params.requestBody)
  // }

  let { url, payload } = parseParams(params, schemas);
  url = options.prefix ? `\`\${baseUrl}${url}\`` : `"${url}"`;


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

  const schemas = json.components.schemas;

  paths.forEach((path) => {
    const info = json.paths[path];
    const method = Object.keys(info)[0];

    const template = getApi({ path, method, ...info[method] }, options, schemas);

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