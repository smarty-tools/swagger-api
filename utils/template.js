function getTemplateHeader(info) {
  return `import axiosInstance from "axios";
const baseUrl = "${info.baseUrl}";
`
};

function getApiTemplate(params, options) {
  const hasPayload = !!params.payload;

  const isTS = options.suffix === "ts";
  const response = isTS ? `: Promise<${params.response}>` : "";

  return `
/**
 * ${params.summary || "请补充描述..."}
 * @param {*} ${hasPayload ? "params" : ""}
 * @returns
 */
export const ${params.operationId} = async (${params.arguments})${response}  => {
  const response = await axiosInstance.${params.method}(${params.url}${hasPayload ? `, ${params.payload}` : ""});

  return response;
};
`
}

module.exports = {
  getTemplateHeader,
  getApiTemplate
}