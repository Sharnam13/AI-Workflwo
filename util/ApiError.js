class ApiError extends Error{
  constructor(message="Error Found",statusCode,errors=[],stack=""){
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.errors = errors;
    this.data=null;
    this.success=false;
    if(stack){
      this.stack = stack;
    }
    else
    {
      Error.captureStackTrace(this,this.constructor);
    }

  }
}
export { ApiError }