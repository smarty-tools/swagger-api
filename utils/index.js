const getTemplateHeader = (info) => {
  return `
const baseUrl = "${info.baseUrl}";
`
};

const getApi = (params, options) => {

  const payload = params.method === "get" ? "{ params }" : "params";
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

exports = {
  getTemplateHeader,
  getApi,
}

module.exports = exports;
