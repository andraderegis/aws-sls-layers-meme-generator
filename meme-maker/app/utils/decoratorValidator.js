const decoratorValidator = (fn, schema, argsType) => {
  return async function (event) {
    const item = event[argsType];

    const data = argsType === 'body'
      ? JSON.parse(item)
      : item;

    // abortEarly => exibe todos os erros de validação de uma vez
    const { error, value } = await schema.validate(data, { abortEarly: false });

    // altera a instância de arguments, 
    // retornando o value já convertido como json de acordo com o schema definido no joi
    event[argsType] = value;

    // arguments coleta todos os argumentos enviados na chamada da função
    // passando os para frente. O apply retornará a função a ser executada
    // posteriormente
    if (!error) {
      return fn.apply(this, arguments);
    }

    return {
      statusCode: 422,
      body: error.message
    }
  }
}

module.exports = decoratorValidator;